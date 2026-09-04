const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const buckets = new Map();

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const ownOrigin = new URL(request.url).origin;
  const configuredOrigin = env.ALLOWED_ORIGIN;
  const allowed = requestOrigin && (requestOrigin === ownOrigin || requestOrigin === configuredOrigin);
  return allowed ? {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  } : null;
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function isRateLimited(request) {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt >= WINDOW_MS) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 7) return false;
  let totalLength = 0;
  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return false;
    if (message.content.length < 1 || message.content.length > 2_000) return false;
    totalLength += message.content.length;
  }
  return totalLength <= 7_000;
}

export async function onRequestOptions({ request, env }) {
  const cors = corsHeaders(request, env);
  return cors ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!cors) return json({ error: 'Origin not allowed' }, 403);
  if (isRateLimited(request)) return json({ error: 'Too many requests. Please try again shortly.' }, 429, cors);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'JSON content type required' }, 415, cors);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 20_000) return json({ error: 'Request payload is too large' }, 413, cors);

  try {
    const body = await request.json();
    if (!validMessages(body.messages)) return json({ error: 'Invalid request payload' }, 400, cors);
    if (!env.AI_API_KEY) return json({ error: 'AI service is not configured' }, 503, cors);

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AI_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': new URL(request.url).origin,
        'X-Title': 'TIME8 Companion AI',
      },
      body: JSON.stringify({
        // OpenRouter maintains this route as a live free-model fallback. A
        // named free model can disappear without notice, which previously
        // made the production companion unavailable.
        model: 'openrouter/free',
        messages: body.messages,
        max_tokens: 750,
        temperature: 0.7,
      }),
    });
    const data = await upstream.json().catch(() => ({ error: { message: 'Invalid upstream response' } }));
    return json(data, upstream.status, cors);
  } catch {
    return json({ error: 'Unable to process the AI request' }, 500, cors);
  }
}
