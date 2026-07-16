// Dinner RSVP + CHIP Payment API
const CHIP_BRAND = '5fe4a760-766d-42c8-a094-601fc93c924d';
const SECRET = 'rsvp2026';

export async function onRequest(context) {
  const { request, env } = context;
  const { DB, CHIP_SECRET_KEY } = env;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  // GET - admin view
  if (request.method === 'GET') {
    if (url.searchParams.get('secret') !== SECRET) return json({ error: 'Unauthorized' }, 401);
    const { results } = await DB.prepare(`SELECT * FROM dinner_rsvp ORDER BY id DESC LIMIT 200`).all();
    return json({ success: true, count: results.length, rsvps: results });
  }

  // POST - submit RSVP
  if (request.method === 'POST') {
    try {
      const ct = request.headers.get('Content-Type') || '';
      let body;
      if (ct.includes('application/json')) { body = await request.json(); }
      else { const t = await request.text(); body = Object.fromEntries(new URLSearchParams(t)); }

      if (body.secret !== SECRET) return json({ error: 'Unauthorized' }, 403);
      if (!body.name || !body.phone || !body.attendance) return json({ error: 'Missing required fields' }, 400);

      const pax = parseInt(body.pax) || 1;
      const accommodation = parseInt(body.accommodation) || 0;
      const amount = parseFloat(body.amount) || 0;

      const result = await DB.prepare(
        `INSERT INTO dinner_rsvp (timestamp, name, phone, attendance, pax, accommodation, amount, message, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(body.timestamp || new Date().toISOString(), body.name, body.phone, body.attendance, pax, accommodation, amount, body.message || '').run();

      const rsvpId = result.meta.last_row_id;
      let checkoutUrl = null;

      if (amount > 0 && CHIP_SECRET_KEY) {
        try {
          const chipPayload = {
            brand_id: CHIP_BRAND,
            client: { email: body.phone ? `${body.phone}@dinner.local` : 'onjayibrahim@gmail.com', full_name: body.name, phone: body.phone || '', cc: ['onjayibrahim@gmail.com'] },
            purchase: { currency: 'MYR', products: [{ name: 'Dinner RSVP - ' + (body.name || 'Guest'), quantity: 1, price: Math.round(amount * 100) }] },
            success_redirect: `https://dinner.jayibrahimalislam.com/dinner/?status=success&id=${rsvpId}`,
            failure_redirect: `https://dinner.jayibrahimalislam.com/dinner/?status=failed`,
            reference: `DINNER-${rsvpId}`,
          };
          const chipRes = await fetch('https://gate.chip-in.asia/api/v1/purchases/', {
            method: 'POST', headers: { 'Authorization': `Bearer ${CHIP_SECRET_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(chipPayload)
          });
          if (chipRes.ok) {
            const chipData = await chipRes.json();
            checkoutUrl = chipData.checkout_url;
            await DB.prepare(`UPDATE dinner_rsvp SET chip_checkout_url = ?, chip_purchase_id = ? WHERE id = ?`).bind(checkoutUrl || '', chipData.id || '', rsvpId).run();
          }
        } catch (e) { /* CHIP optional */ }
      } else {
        await DB.prepare(`UPDATE dinner_rsvp SET payment_status = 'confirmed' WHERE id = ?`).bind(rsvpId).run();
      }

      return json({ success: true, id: rsvpId, checkoutUrl });
    } catch (err) { return json({ error: 'Server error', detail: err.message }, 500); }
  }
  return json({ error: 'Method not allowed' }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors() } });
}
function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
}
