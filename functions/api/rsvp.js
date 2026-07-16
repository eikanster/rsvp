// Wedding RSVP API
export async function onRequest(context) {
  const { request, env } = context;
  const { DB } = env;
  const url = new URL(request.url);
  const secret = 'rsvp2026';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  if (request.method === 'GET') {
    if (url.searchParams.get('secret') !== secret) return json({ error: 'Unauthorized' }, 401);
    const { results } = await DB.prepare(`SELECT id, timestamp, name, phone, attendance, pax, message FROM wedding_rsvp ORDER BY id DESC LIMIT 200`).all();
    return json({ success: true, count: results.length, rsvps: results });
  }

  if (request.method === 'POST') {
    try {
      const body = await request.text();
      const params = new URLSearchParams(body);
      const data = Object.fromEntries(params);
      if (data.secret !== secret) return json({ error: 'Unauthorized' }, 403);
      if (!data.name || !data.phone || !data.attendance) return json({ error: 'Missing required fields' }, 400);
      await DB.prepare(`INSERT INTO wedding_rsvp (timestamp, name, phone, attendance, pax, message) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(data.timestamp || new Date().toISOString(), data.name, data.phone, data.attendance, data.pax || '1', data.message || '').run();
      return json({ success: true, name: data.name });
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
