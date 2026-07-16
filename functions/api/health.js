export async function onRequest() {
  return new Response('{"ok":true}', {
    headers: { "Content-Type": "application/json" }
  });
}
