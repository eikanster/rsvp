// RSVP API — Catch-all handler for /api/*
const SECRET = 'rsvp2026';
const CHIP_BRAND = '5fe4a760-766d-42c8-a094-601fc93c924d';

export async function onRequest(context) {
  const { request, env } = context;
  const { DB, CHIP_SECRET_KEY } = env;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') return cors204();

  try {
    // Health
    if (path === '/api/health') return json({ status: 'ok', version: 'rsvp' });

    // Wedding RSVP
    if (path === '/api/rsvp') {
      if (method === 'GET') {
        if (url.searchParams.get('secret') !== SECRET) return json({ error: 'Unauthorized' }, 401);
        const { results } = await DB.prepare(`SELECT id, timestamp, name, phone, attendance, pax, message FROM wedding_rsvp ORDER BY id DESC LIMIT 200`).all();
        return json({ success: true, count: results.length, rsvps: results });
      }
      if (method === 'POST') {
        const body = await request.text();
        const data = Object.fromEntries(new URLSearchParams(body));
        if (data.secret !== SECRET) return json({ error: 'Unauthorized' }, 403);
        if (!data.name || !data.phone || !data.attendance) return json({ error: 'Missing fields' }, 400);
        await DB.prepare(`INSERT INTO wedding_rsvp (timestamp, name, phone, attendance, pax, message) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(data.timestamp || new Date().toISOString(), data.name, data.phone, data.attendance, data.pax || '1', data.message || '').run();
        return json({ success: true, name: data.name });
      }
    }

    // Wedding Config
    if (path === '/api/wedding-config') {
      if (method === 'GET') {
        const { results } = await DB.prepare(`SELECT key, value, updated_at FROM wedding_config ORDER BY key`).all();
        const config = {}; results.forEach(r => { config[r.key] = r.value });
        return json({ success: true, config, updated: results[0]?.updated_at });
      }
      if (method === 'POST') {
        const { s, updates } = await parseConfigBody(request);
        if (s !== SECRET) return json({ error: 'Unauthorized' }, 403);
        if (!Object.keys(updates).length) return json({ error: 'No config' }, 400);
        const stmt = DB.prepare(`INSERT OR REPLACE INTO wedding_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`);
        await DB.batch(Object.entries(updates).map(([k, v]) => stmt.bind(k, String(v))));
        return json({ success: true, updated: Object.keys(updates).length });
      }
    }

    // Dinner RSVP
    if (path === '/api/dinner-rsvp') {
      if (method === 'GET') {
        if (url.searchParams.get('secret') !== SECRET) return json({ error: 'Unauthorized' }, 401);
        const { results } = await DB.prepare(`SELECT * FROM dinner_rsvp ORDER BY id DESC LIMIT 200`).all();
        return json({ success: true, count: results.length, rsvps: results });
      }
      if (method === 'POST') {
        const ct = request.headers.get('Content-Type') || '';
        let body;
        if (ct.includes('application/json')) { body = await request.json(); }
        else { body = Object.fromEntries(new URLSearchParams(await request.text())); }
        if (body.secret !== SECRET) return json({ error: 'Unauthorized' }, 403);
        if (!body.name || !body.phone || !body.attendance) return json({ error: 'Missing fields' }, 400);
        const pax = parseInt(body.pax) || 1;
        const acco = parseInt(body.accommodation) || 0;
        const amount = parseFloat(body.amount) || 0;
        const result = await DB.prepare(`INSERT INTO dinner_rsvp (timestamp, name, phone, attendance, pax, accommodation, amount, message, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`)
          .bind(body.timestamp || new Date().toISOString(), body.name, body.phone, body.attendance, pax, acco, amount, body.message || '').run();
        const rsvpId = result.meta.last_row_id;
        let checkoutUrl = null;
        if (amount > 0 && CHIP_SECRET_KEY) {
          try {
            const chipRes = await fetch('https://gate.chip-in.asia/api/v1/purchases/', {
              method: 'POST', headers: { 'Authorization': `Bearer ${CHIP_SECRET_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                brand_id: CHIP_BRAND,
                client: { email: body.phone ? `${body.phone}@dinner.local` : 'onjayibrahim@gmail.com', full_name: body.name, phone: body.phone || '', cc: ['onjayibrahim@gmail.com'] },
                purchase: { currency: 'MYR', products: [{ name: 'Dinner RSVP - ' + (body.name || 'Guest'), quantity: 1, price: Math.round(amount * 100) }] },
                success_redirect: `https://dinner.jayibrahimalislam.com/dinner/?status=success&id=${rsvpId}`,
                failure_redirect: `https://dinner.jayibrahimalislam.com/dinner/?status=failed`,
                reference: `DINNER-${rsvpId}`,
              })
            });
            if (chipRes.ok) {
              const chipData = await chipRes.json();
              checkoutUrl = chipData.checkout_url;
              await DB.prepare(`UPDATE dinner_rsvp SET chip_checkout_url = ?, chip_purchase_id = ? WHERE id = ?`).bind(checkoutUrl || '', chipData.id || '', rsvpId).run();
            }
          } catch (e) { /* optional */ }
        } else {
          await DB.prepare(`UPDATE dinner_rsvp SET payment_status = 'confirmed' WHERE id = ?`).bind(rsvpId).run();
        }
        return json({ success: true, id: rsvpId, checkoutUrl });
      }
    }

    // Dinner Config
    if (path === '/api/dinner-config') {
      if (method === 'GET') {
        const { results } = await DB.prepare(`SELECT key, value, updated_at FROM dinner_config ORDER BY key`).all();
        const config = {}; results.forEach(r => { config[r.key] = r.value });
        return json({ success: true, config, updated: results[0]?.updated_at });
      }
      if (method === 'POST') {
        const { s, updates } = await parseConfigBody(request);
        if (s !== SECRET) return json({ error: 'Unauthorized' }, 403);
        if (!Object.keys(updates).length) return json({ error: 'No config' }, 400);
        const stmt = DB.prepare(`INSERT OR REPLACE INTO dinner_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`);
        await DB.batch(Object.entries(updates).map(([k, v]) => stmt.bind(k, String(v))));
        return json({ success: true, updated: Object.keys(updates).length });
      }
    }

  } catch (err) {
    return json({ error: 'Server error', detail: err.message }, 500);
  }

  return json({ error: 'Not found' }, 404);
}

// Helpers
async function parseConfigBody(request) {
  const ct = request.headers.get('Content-Type') || '';
  let s = '', updates = {};
  if (ct.includes('application/json')) {
    const body = await request.json(); s = body.secret; updates = body.config || {};
  } else {
    const text = await request.text(); const p = new URLSearchParams(text);
    s = p.get('secret'); p.forEach((v, k) => { if (k.startsWith('cfg_')) updates[k.replace('cfg_', '')] = v });
  }
  return { s, updates };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

function cors204() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
