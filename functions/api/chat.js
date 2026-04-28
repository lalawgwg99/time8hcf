const DEFAULT_ALLOWED_MODELS = ['stepfun/step-3.5-flash:free'];
const DEFAULT_ALLOWED_ORIGINS = ['https://time8hcf.pages.dev', 'http://localhost:8788'];
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function splitCsv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedOrigins(env, requestHost) {
  const configured = splitCsv(env.ALLOWED_ORIGINS);
  const origins = configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
  return new Set([...origins, `https://${requestHost}`]);
}

function getAllowedModels(env) {
  const configured = splitCsv(env.ALLOWED_MODELS);
  return configured.length > 0 ? new Set(configured) : new Set(DEFAULT_ALLOWED_MODELS);
}

function resolveRequestOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return '';
  try {
    return new URL(origin).origin;
  } catch {
    return '';
  }
}

function buildCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function isValidMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) return false;

  return messages.every((message) => {
    if (!message || typeof message !== 'object') return false;
    if (typeof message.role !== 'string') return false;
    if (typeof message.content !== 'string') return false;
    return message.content.length > 0 && message.content.length <= 6000;
  });
}

function normalizeNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function validatePayload(body, allowedModels) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid JSON body' };
  }

  if (!isValidMessages(body.messages)) {
    return { ok: false, error: 'Invalid messages format' };
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model || !allowedModels.has(model)) {
    return { ok: false, error: 'Model is not allowed' };
  }

  return {
    ok: true,
    payload: {
      model,
      messages: body.messages,
      max_tokens: Math.round(normalizeNumber(body.max_tokens, 500, 32, 800)),
      temperature: normalizeNumber(body.temperature, 0.7, 0, 1.2),
    },
  };
}

export async function onRequestOptions({ request, env }) {
  const requestHost = new URL(request.url).host;
  const allowedOrigins = getAllowedOrigins(env, requestHost);
  const origin = resolveRequestOrigin(request);
  const allowedOrigin = allowedOrigins.has(origin) ? origin : '';
  return new Response(null, { headers: buildCorsHeaders(allowedOrigin) });
}

export async function onRequestPost({ request, env }) {
  const requestHost = new URL(request.url).host;
  const allowedOrigins = getAllowedOrigins(env, requestHost);
  const requestOrigin = resolveRequestOrigin(request);
  const isOriginAllowed = allowedOrigins.has(requestOrigin);
  const corsHeaders = buildCorsHeaders(isOriginAllowed ? requestOrigin : '');

  if (requestOrigin && !isOriginAllowed) {
    return jsonResponse({ error: 'Origin is not allowed' }, 403, corsHeaders);
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'OPENROUTER_API_KEY is not configured' }, 500, corsHeaders);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON' }, 400, corsHeaders);
  }

  const validation = validatePayload(body, getAllowedModels(env));
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400, corsHeaders);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstreamResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': `https://${requestHost}`,
        'X-Title': 'ippitsu-time-tracker',
      },
      body: JSON.stringify(validation.payload),
      signal: controller.signal,
    });

    const responseText = await upstreamResponse.text();
    let responsePayload;
    try {
      responsePayload = JSON.parse(responseText);
    } catch {
      responsePayload = { error: 'Invalid upstream response', raw: responseText.slice(0, 400) };
    }

    return jsonResponse(responsePayload, upstreamResponse.status, corsHeaders);
  } catch (error) {
    const isTimeoutError = error && error.name === 'AbortError';
    return jsonResponse(
      { error: isTimeoutError ? 'Upstream timeout' : 'Upstream request failed' },
      502,
      corsHeaders,
    );
  } finally {
    clearTimeout(timeout);
  }
}
