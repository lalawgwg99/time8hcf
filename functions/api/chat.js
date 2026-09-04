function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const ownOrigin = new URL(request.url).origin;
  const allowed = requestOrigin && (requestOrigin === ownOrigin || requestOrigin === env.ALLOWED_ORIGIN);
  return allowed ? { 'Access-Control-Allow-Origin': requestOrigin, 'Vary': 'Origin' } : null;
}

export async function onRequestOptions({ request, env }) {
  const cors = corsHeaders(request, env);
  return cors ? new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }) : new Response(null, { status: 403 });
}

// Kept only to return a safe, explicit response for legacy clients. It is no
// longer an unrestricted proxy to any model or provider.
export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!cors) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ error: 'This endpoint has been retired. Use /api/ai.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...cors },
  });
}
