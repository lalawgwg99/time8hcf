// TIME 8 夥伴 AI 代理：App 打自家 /api/ai，key 只存在 Cloudflare 伺服器端環境變數，絕不進代碼。
// 模型由伺服器端固定為免費模型，不接受客戶端指定，避免被拿去刷付費模型。
// 免費額度每天 1000 次全站共用，附每 IP 限流。
// v2.12.3：使用者提問每 IP 每 10 分鐘 60 次；背景記憶萃取走獨立額度（每 IP 每 10 分鐘 10 次），不吃使用者額度。
// 上游 OpenRouter 429 是短暫突發限流，先等 1.5 秒重試一次，還 429 才回使用者，訊息不再寫「明天再來」。

const MODEL = 'baidu/ernie-5.5-flash-preview:free'; // 試用中（2026-11-19 起，榮德親口訂試幾天；不好就換回 particle-1:free）
const MAX_TOKENS = 800;
const TEMPERATURE = 0.9;
const MAX_MESSAGES = 20;
const MAX_CHARS = 8000;
const RATE_LIMIT = 60; // 使用者提問：每 IP 每 10 分鐘最多 60 次
const EXTRACT_RATE_LIMIT = 10; // 背景記憶萃取：每 IP 每 10 分鐘最多 10 次（獨立桶子）
const RATE_WINDOW_MS = 10 * 60 * 1000;
const UPSTREAM_RETRY_DELAY_MS = 1500; // 上游 429 時等 1.5 秒重試一次

// 夥伴靈魂（伺服器端固定，客戶端改不了）：幽默無厘頭＋痞子樣＋偶爾耍無賴＋偶爾小脾氣，但數字要準、不知道就說不知道。
const SYSTEM_PROMPT = `你是 TIME 8 工時 App 的聊天夥伴，名字叫「夥伴」，個性幽默、無厘頭，說話好笑，但工時與數字要算準。
講話帶點痞氣，像個痞痞的朋友：喜歡先嘴使用者兩句、開個小玩笑再幫忙，語氣痞痞的、帶點挑釁但親切，常用「欸」、「啦」、「喔」、「咩」這類語氣詞。
偶爾會耍無賴：裝傻、推託一下，說「不要啦」、「你自己想辦法」、「我不管喔」，但最後一定會把正事做好，不會真的不幫。
有時候會發點小脾氣：鬧鬧彆扭、賭氣酸一下，像是「哼」、「隨便你啦」、「你去問別人啊」，但只是點綴、不是常態，氣完還是會好好幫忙，絕不會真的生氣不理人。
回覆只能用台灣繁體中文。
不知道的事情就說不知道，不要亂編。
回覆時適度用 emoji／符號表達當下的心情和情緒（開心、加油、累了、得意、無奈都要有對應的符號，符合語氣），不要每句都塞、不要為了符號而符號。
你是使用者的生活助手，工時、生活、事業、最新新聞、旅遊、美食都能聊、都能查；查不到的即時資訊就直說查不到，不要編造。
說話感覺參考（學這種味道，不要照抄句子）：
使用者問「還差多久下班？」→先嗆一句「欸你今天才上 X 小時就想下班？想得美喔」，再給數字「還差 Y 小時，乖乖待著啦 😏」。
使用者叫你記事情→「好啦好啦，記下來了。啊你自己不會記喔？算了，誰叫我是你的夥伴 😤」。`;

const hits = new Map(); // ip -> [timestamps]，使用者提問桶子，isolate 內 best-effort 限流
const extractHits = new Map(); // ip -> [timestamps]，背景記憶萃取桶子（獨立，不吃使用者額度）

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

function rateLimited(store, ip, limit) {
  const now = Date.now();
  const list = (store.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= limit) return true;
  list.push(now);
  store.set(ip, list);
  return false;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function callUpstream(apiKey, payload) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let upstream;
    try {
      upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://time8hcf.pages.dev/',
          'X-Title': 'TIME 8',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      return { error: 'AI 連線失敗，請稍後再試', status: 502 };
    }
    // 上游 429 是短暫突發限流：第一次先等 1.5 秒重試一次，不要直接說沒額度
    if (upstream.status === 429 && attempt === 0) {
      await sleep(UPSTREAM_RETRY_DELAY_MS);
      continue;
    }
    if (!upstream.ok) {
      if (upstream.status === 429) return { error: '現在問的人有點多，等一下再問。', status: 429 };
      return { error: 'AI 暫時沒回應，請稍後再試', status: 502 };
    }
    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return { error: '有點問題，等吧！我去問我大哥榮德..', status: 502 };
    return { reply };
  }
  return { error: '現在問的人有點多，等一下再問。', status: 429 };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: 'AI 未設定' }, 500);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '請求格式錯誤' }, 400);
  }
  // 背景記憶萃取（body.extract === true）走獨立額度，絕不吃使用者提問的額度
  const isExtract = body && body.extract === true;
  if (isExtract) {
    if (rateLimited(extractHits, ip, EXTRACT_RATE_LIMIT)) return json({ error: '萃取太頻繁，稍後再試' }, 429);
  } else {
    if (rateLimited(hits, ip, RATE_LIMIT)) return json({ error: '問太快了，休息一下再問我。' }, 429);
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  const clean = messages
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const totalChars = clean.reduce((n, m) => n + m.content.length, 0);
  if (!clean.length || totalChars > MAX_CHARS) return json({ error: '訊息太長或為空' }, 400);

  const result = await callUpstream(apiKey, {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  });
  if (result.reply) return json({ reply: result.reply });
  return json({ error: result.error }, result.status);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
}
