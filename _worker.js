export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // ─── Health ───────────────────────────────────
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        ok: true, db: !!env.DB,
        chip_key: !!env.CHIP_API_KEY,
        chip_brand: env.CHIP_BRAND_ID || null
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // ─── RSVP ────────────────────────────────────
    if (url.pathname === '/api/rsvp') {
      return handleRSVP(request, env, url, headers);
    }

    // ─── Config ──────────────────────────────────
    if (url.pathname === '/api/config') {
      return handleConfig(request, env, url, headers);
    }

    // ─── CHIP Webhook ────────────────────────────
    if (url.pathname === '/api/webhook') {
      return handleWebhook(request, env, headers);
    }

    // ─── Upload ──────────────────────────────────
    if (url.pathname === '/api/upload') {
      return handleUpload(request, env, url, headers);
    }

    // ─── Static ──────────────────────────────────
    return env.ASSETS.fetch(request);
  }
};

// ═══════════════════════════════════════════════════
//  RSVP: GET list / POST submit
// ═══════════════════════════════════════════════════
async function handleRSVP(request, env, url, headers) {
  const category = url.searchParams.get('category') || 'wedding';
  const secret = url.searchParams.get('secret');

  // ── GET: list RSVPs (admin) ──
  if (request.method === 'GET') {
    if (secret !== 'rsvp2026') {
      return json({ error: 'Unauthorized' }, 401, headers);
    }
    const { results } = await env.DB.prepare(
      'SELECT * FROM rsvp WHERE category = ? ORDER BY id DESC'
    ).bind(category).all();
    return json({ rsvps: results }, 200, headers);
  }

  // ── POST: submit RSVP ──
  if (request.method === 'POST') {
    const body = await request.text();
    const p = new URLSearchParams(body);

    if (p.get('secret') !== 'rsvp2026') {
      return json({ error: 'Unauthorized' }, 401, headers);
    }

    const name = p.get('name')?.trim();
    const phone = p.get('phone')?.trim();
    const attendance = p.get('attendance');
    const pax = parseInt(p.get('pax')) || 0;
    const accommodation = parseInt(p.get('accommodation')) || 0;
    const amount = parseInt(p.get('amount')) || 0;
    const message = p.get('message')?.trim() || '';
    const timestamp = new Date().toISOString();

    if (!name || !phone || !attendance) {
      return json({ error: 'Name, phone, and attendance are required' }, 400, headers);
    }

    // For dinner: create CHIP checkout if amount > 0
    let checkoutUrl = null;
    let checkoutId = null;
    if (amount > 0 && env.CHIP_API_KEY && env.CHIP_BRAND_ID) {
      try {
        const chipResp = await fetch('https://gate.chip-in.asia/api/v1/purchases/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CHIP_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_id: env.CHIP_BRAND_ID,
            client: {
              full_name: name,
              phone: phone.startsWith('+') ? phone : '+6' + phone.replace(/^\+/, ''),
            },
            purchase: {
              products: [{
                name: `${category === 'dinner' ? 'Dinner' : 'Event'} RSVP — ${name}`,
                price: Math.round(amount * 100), // CHIP expects sen
                quantity: 1,
              }],
              total: Math.round(amount * 100),
              notes: `${category} RSVP — ${name} / ${phone} / ${pax} pax`,
            },
            success_redirect: `${url.origin}/${category}?status=success&id={checkout_id}`,
            failure_redirect: `${url.origin}/${category}?status=failed&id={checkout_id}`,
            success_callback: `${url.origin}/api/webhook`,
          }),
        });
        const chipData = await chipResp.json();
        if (chipData.checkout_url) {
          checkoutUrl = chipData.checkout_url;
          checkoutId = chipData.id;
        }
      } catch (e) {
        console.error('CHIP error:', e);
      }
    }

    const { success, meta } = await env.DB.prepare(
      `INSERT INTO rsvp (category, name, phone, attendance, pax, accommodation, amount, message, payment_status, checkout_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(category, name, phone, attendance, pax, accommodation, amount, message,
           amount > 0 ? 'pending' : 'free', checkoutId, timestamp).run();

    if (!success) {
      return json({ error: 'Failed to save' }, 500, headers);
    }

    return json({ ok: true, id: meta.last_row_id, checkoutUrl, checkoutId }, 200, headers);
  }

  return json({ error: 'Method not allowed' }, 405, headers);
}

// ═══════════════════════════════════════════════════
//  CONFIG: GET load / POST save
// ═══════════════════════════════════════════════════
async function handleConfig(request, env, url, headers) {
  const category = url.searchParams.get('category') || 'wedding';

  // ── GET: load config ──
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT key, value FROM config WHERE category = ?'
    ).bind(category).all();

    const config = {};
    for (const row of results) {
      config[row.key] = row.value;
    }
    return json({ config }, 200, headers);
  }

  // ── POST: save config (admin) ──
  if (request.method === 'POST') {
    const body = await request.text();
    const p = new URLSearchParams(body);

    if (p.get('secret') !== 'rsvp2026') {
      return json({ error: 'Unauthorized' }, 401, headers);
    }

    let updated = 0;
    for (const [k, v] of p.entries()) {
      if (k === 'secret' || k === 'category') continue;
      // cfg_ prefix → strip it
      const key = k.startsWith('cfg_') ? k.slice(4) : k;
      await env.DB.prepare(
        `INSERT INTO config (category, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(category, key) DO UPDATE SET value = ?, updated_at = ?`
      ).bind(category, key, v, Date.now(), v, Date.now()).run();
      updated++;
    }

    return json({ success: true, updated }, 200, headers);
  }

  return json({ error: 'Method not allowed' }, 405, headers);
}

// ═══════════════════════════════════════════════════
//  CHIP WEBHOOK
// ═══════════════════════════════════════════════════
async function handleWebhook(request, env, headers) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, headers);
  }

  try {
    const body = await request.text();
    const p = new URLSearchParams(body);
    const checkoutId = p.get('id');
    const status = p.get('status');

    if (!checkoutId) {
      return json({ error: 'Missing id' }, 400, headers);
    }

    // Verify with CHIP
    if (env.CHIP_API_KEY) {
      const verifyResp = await fetch(`https://gate.chip-in.asia/api/v1/purchases/${checkoutId}/`, {
        headers: { 'Authorization': `Bearer ${env.CHIP_API_KEY}` },
      });
      const verifyData = await verifyResp.json();
      const chipStatus = verifyData.status;

      if (chipStatus === 'paid' || chipStatus === 'confirmed') {
        await env.DB.prepare(
          'UPDATE rsvp SET payment_status = ? WHERE checkout_id = ?'
        ).bind('paid', checkoutId).run();
      } else if (chipStatus === 'failed' || chipStatus === 'cancelled') {
        await env.DB.prepare(
          'UPDATE rsvp SET payment_status = ? WHERE checkout_id = ?'
        ).bind('failed', checkoutId).run();
      }
    }

    return new Response('OK', { status: 200, headers });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('OK', { status: 200, headers });
  }
}

// ═══════════════════════════════════════════════════
//  UPLOAD: save to R2
// ═══════════════════════════════════════════════════
async function handleUpload(request, env, url, headers) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, headers);
  }

  const contentType = request.headers.get('Content-Type') || '';
  const category = url.searchParams.get('category') || 'wedding';

  // Multipart form data
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return json({ error: 'Missing file' }, 400, headers);
    }

    // Validate
    if (!file.type.startsWith('image/')) {
      return json({ error: 'Only images allowed' }, 400, headers);
    }
    if (file.size > 10 * 1024 * 1024) {
      return json({ error: 'Max 10MB' }, 400, headers);
    }

    const key = `rsvp/${category}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    // Public URL via custom domain
    const publicUrl = `https://link.jayibrahimalislam.com/${key}`;

    return json({ ok: true, url: publicUrl, key }, 200, headers);
  }

  // Fallback: raw binary upload
  if (contentType.startsWith('image/')) {
    const key = `rsvp/${category}/${Date.now()}.webp`;
    await env.BUCKET.put(key, request.body, {
      httpMetadata: { contentType },
    });

    const publicUrl = `https://link.jayibrahimalislam.com/${key}`;
    return json({ ok: true, url: publicUrl, key }, 200, headers);
  }

  return json({ error: 'Unsupported content type' }, 400, headers);
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}
