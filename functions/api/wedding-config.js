// Wedding Config API
export async function onRequest(context) {
  const { request, env } = context;
  const { DB } = env;
  const secret = 'rsvp2026';

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  if (request.method === 'GET') {
    const { results } = await DB.prepare(`SELECT key, value, updated_at FROM wedding_config ORDER BY key`).all();
    const config = {}; results.forEach(r => { config[r.key] = r.value });
    return json({ success: true, config, updated: results[0]?.updated_at });
  }

  if (request.method === 'POST') {
    try {
      const ct = request.headers.get('Content-Type') || '';
      let updates = {}, s = '';
      if (ct.includes('application/json')) {
        const body = await request.json(); s = body.secret; updates = body.config || {};
      } else {
        const text = await request.text(); const p = new URLSearchParams(text);
        s = p.get('secret'); p.forEach((v, k) => { if (k.startsWith('cfg_')) updates[k.replace('cfg_', '')] = v });
      }
      if (s !== secret) return json({ error: 'Unauthorized' }, 403);
      if (!Object.keys(updates).length) return json({ error: 'No config' }, 400);
      const stmt = DB.prepare(`INSERT OR REPLACE INTO wedding_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`);
      await DB.batch(Object.entries(updates).map(([k, v]) => stmt.bind(k, String(v))));
      return json({ success: true, updated: Object.keys(updates).length });
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
