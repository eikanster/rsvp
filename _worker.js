export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, db: !!env.DB }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Pass everything else to static assets
    return env.ASSETS.fetch(request);
  }
};
