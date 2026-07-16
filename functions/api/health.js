export async function onRequest() {
  return new Response(JSON.stringify({ status: 'ok', version: 'rsvp' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
