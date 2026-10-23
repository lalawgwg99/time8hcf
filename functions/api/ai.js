const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const buckets = new Map();

const OPENROUTER_FREE_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'openrouter/free',
];

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const ownOrigin = new URL(request.url).origin;
  const configuredOrigin = env.ALLOWED_ORIGIN;
  const allowed = !requestOrigin || requestOrigin === ownOrigin || requestOrigin === configuredOrigin;
  return allowed ? {
    'Access-Control-Allow-Origin': requestOrigin || ownOrigin,
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
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 16) return false;
  let totalLength = 0;
  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return false;
    if (message.content.length < 1 || message.content.length > 6_000) return false;
    totalLength += message.content.length;
  }
  return totalLength <= 24_000;
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
  if (Number(request.headers.get('Content-Length') || 0) > 48_000) return json({ error: 'Request payload is too large' }, 413, cors);

  try {
    const body = await request.json();
    if (!validMessages(body.messages)) return json({ error: 'Invalid request payload' }, 400, cors);

    // Tier 1: OpenRouter Multi-Model Pool (if AI_API_KEY is configured)
    if (env.AI_API_KEY) {
      for (const model of OPENROUTER_FREE_MODELS) {
        try {
          const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.AI_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': new URL(request.url).origin,
              'X-Title': 'TIME8 Jellyfish AI',
            },
            body: JSON.stringify({
              model,
              messages: body.messages,
              max_tokens: 1200,
              temperature: 0.7,
            }),
          });
          if (upstream.ok) {
            const data = await upstream.json().catch(() => null);
            if (data?.choices?.[0]?.message?.content) {
              return json(data, 200, cors);
            }
          }
        } catch {
          // Try next model
        }
      }
    }

    // Tier 2: Zero-Key Cloud LLM Fallback (Pollinations OpenAI-compatible endpoint)
    for (const fallbackModel of ['openai', 'mistral']) {
      try {
        const pubRes = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: fallbackModel,
            messages: body.messages,
            temperature: 0.7,
          }),
        });
        if (pubRes.ok) {
          const pubData = await pubRes.json().catch(() => null);
          if (pubData?.choices?.[0]?.message?.content) {
            return json(pubData, 200, cors);
          }
        }
      } catch {
        // Continue fallback
      }
    }

    return json({ error: { message: 'All upstream AI providers are temporarily busy' } }, 503, cors);
  } catch {
    return json({ error: 'Unable to process the AI request' }, 500, cors);
  }
}
