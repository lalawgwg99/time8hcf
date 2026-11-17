// TIME 8 夥伴 AI 代理：App 打自家 /api/ai，key 只存在 Cloudflare 伺服器端環境變數，絕不進代碼。
// 模型由伺服器端固定為免費模型，不接受客戶端指定，避免被拿去刷付費模型。
// 免費額度每天 1000 次全站共用，附每 IP 限流。

const MODEL = 'particle-ai/particle-1:free'; // 當日主力免費模型（每日掃描更新）
const MAX_TOKENS = 800;
const TEMPERATURE = 0.9;
const MAX_MESSAGES = 20;
const MAX_CHARS = 8000;
const RATE_LIMIT = 20; // 每 IP 每 10 分鐘最多 20 次
const RATE_WINDOW_MS = 10 * 60 * 1000;

const hits = new Map(); // ip -> [timestamps]，isolate 內 best-effort 限流

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: 'AI 未設定' }, 500);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (rateLimited(ip)) return json({ error: '問太快了，休息一下再問' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '請求格式錯誤' }, 400);
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  const clean = messages
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const totalChars = clean.reduce((n, m) => n + m.content.length, 0);
  if (!clean.length || totalChars > MAX_CHARS) return json({ error: '訊息太長或為空' }, 400);

  let upstream;
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://time8hcf.pages.dev/',
        'X-Title': 'TIME 8',
      },
      body: JSON.stringify({ model: MODEL, messages: clean, max_tokens: MAX_TOKENS, temperature: TEMPERATURE }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return json({ error: 'AI 連線失敗，請稍後再試' }, 502);
  }
  if (!upstream.ok) {
    if (upstream.status === 429) return json({ error: 'AI 今天問太多了，明天再來' }, 429);
    return json({ error: 'AI 暫時沒回應，請稍後再試' }, 502);
  }
  const data = await upstream.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) return json({ error: 'AI 沒回話，請再問一次' }, 502);
  return json({ reply });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
}
