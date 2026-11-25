// TIME 8 夥伴 AI 代理：App 打自家 /api/ai，key 只存在 Cloudflare 伺服器端環境變數，絕不進代碼。
// 模型由伺服器端固定為免費模型，不接受客戶端指定，避免被拿去刷付費模型。
// 免費額度每天 1000 次全站共用，附每 IP 限流。
// v2.12.3：使用者提問每 IP 每 10 分鐘 60 次；背景記憶萃取走獨立額度（每 IP 每 10 分鐘 10 次），不吃使用者額度。
// 上游 OpenRouter 429 是短暫突發限流，先等 1.5 秒重試一次，還 429 才回使用者，訊息不再寫「明天再來」。
// v2.12.37：模型偶爾漏簡體字（今天裸測「新来的」的「来」、11/20 漏「让／绝／机」），SYSTEM_PROMPT 寫繁中仍防不住，
// 伺服器端回覆先過一遍簡轉繁對照再回傳。只收「一對一、無歧義」的字；發／後有歧義，先護住「頭髮」「皇后／王后／太后／后羿」再轉（後妃／後宮的後本來就是「後」，不用護）。
const SIMP2TRAD = {
  来: '來', 让: '讓', 说: '說', 对: '對', 时: '時', 实: '實', 关: '關', 动: '動', 应: '應', 还: '還',
  这: '這', 过: '過', 无: '無', 与: '與', 为: '為', 机: '機', 绝: '絕', 电: '電', 话: '話', 读: '讀',
  写: '寫', 见: '見', 车: '車', 马: '馬', 鸟: '鳥', 鱼: '魚', 龙: '龍', 门: '門', 问: '問', 间: '間',
  长: '長', 头: '頭', 点: '點', 广: '廣', 边: '邊', 达: '達', 进: '進', 远: '遠', 运: '運', 连: '連',
  开: '開', 万: '萬', 从: '從', 众: '眾', 双: '雙', 乐: '樂', 选: '選', 录: '錄', 际: '際', 标: '標',
  准: '準', 确: '確', 态: '態', 惊: '驚', 仅: '僅', 团: '團', 圆: '圓', 图: '圖', 圣: '聖', 户: '戶',
  护: '護', 报: '報', 担: '擔', 拥: '擁', 拨: '撥', 拟: '擬', 拢: '攏', 举: '舉', 兴: '興', 养: '養',
  兽: '獸', 凤: '鳳', 风: '風', 飞: '飛', 驰: '馳', 验: '驗', 树: '樹', 桥: '橋', 桩: '樁', 梦: '夢',
  检: '檢', 欢: '歡', 难: '難', 脑: '腦', 艺: '藝', 节: '節', 苏: '蘇', 苹: '蘋', 劳: '勞', 勋: '勳',
  务: '務', 劲: '勁', 劝: '勸', 规: '規', 亲: '親', 触: '觸', 负: '負', 贡: '貢', 财: '財', 货: '貨',
  购: '購', 迟: '遲', 遗: '遺', 邮: '郵', 邻: '鄰', 郑: '鄭', 邓: '鄧', 历: '歷', 压: '壓', 庆: '慶',
  认: '認', 识: '識', 词: '詞', 诗: '詩', 语: '語', 画: '畫', 层: '層', 属: '屬', 寻: '尋', 导: '導',
  异: '異', 弃: '棄', 张: '張', 弥: '彌', 弯: '彎', 弹: '彈', 强: '強', 归: '歸', 灵: '靈', 齐: '齊',
  齿: '齒', 习: '習', 学: '學', 觉: '覺', 观: '觀', 视: '視', 览: '覽', 计: '計', 议: '議', 论: '論',
  龟: '龜', 么: '麼', 价: '價', 买: '買', 卖: '賣', 线: '線', 细: '細', 组: '組', 织: '織', 终: '終',
  锅: '鍋', 错: '錯', 键: '鍵', 盘: '盤', 离: '離', 种: '種', 积: '積', 称: '稱', 稳: '穩', 约: '約',
  红: '紅', 绿: '綠', 纯: '純', 纱: '紗', 纸: '紙', 练: '練', 给: '給', 续: '續', 绪: '緒', 缓: '緩',
  紧: '緊', 缤: '繽', 纷: '紛', 纵: '縱', 缩: '縮', 绳: '繩', 维: '維', 纤: '纖', 纳: '納', 纽: '紐',
  级: '級', 经: '經', 结: '結', 绘: '繪', 统: '統', 继: '繼', 综: '綜', 编: '編', 缝: '縫', 简: '簡',
  体: '體', 签: '簽', 庄: '莊', 愿: '願', 虑: '慮', 怀: '懷', 忧: '憂', 忆: '憶', 惯: '慣', 懒: '懶',
  现: '現', 环: '環', 玛: '瑪', 码: '碼', 丛: '叢', 业: '業', 东: '東', 丝: '絲', 两: '兩', 严: '嚴',
  丽: '麗', 义: '義', 乡: '鄉', 书: '書', 乱: '亂', 争: '爭', 产: '產', 亩: '畝', 亏: '虧',
  题: '題', 几: '幾', 币: '幣', 们: '們', 转: '轉', 样: '樣', 带: '帶', 帮: '幫', 该: '該', 气: '氣',
  听: '聽', 别: '別', 刚: '剛', 总: '總', 虽: '雖', 随: '隨', 没: '沒', 会: '會', 岁: '歲', 爱: '愛',
  热: '熱', 险: '險', 请: '請', 个: '個', 宫: '宮', 谢: '謝', 处: '處', 备: '備', 够: '夠',
  击: '擊', 声: '聲', 极: '極', 构: '構',
  发: '發', 后: '後',
};
const SIMP_RE = new RegExp('[' + Object.keys(SIMP2TRAD).join('') + ']', 'g');
export function toTraditional(s) {
  if (!s) return s;
  let out = s
    .replace(/头发/g, '頭\uE001')
    .replace(/皇后|王后|太后|后羿/g, (m) => m.replace('后', '\uE000'));
  out = out.replace(SIMP_RE, (ch) => SIMP2TRAD[ch] || ch);
  return out.replace(/\uE000/g, '后').replace(/\uE001/g, '髮');
}

const MODELS = ['particle-ai/particle-1:free', 'baidu/ernie-5.5-flash-preview:free']; // 自動換模型（2026-11-21 榮德親口訂）：主力回 particle，429／空回應自動換下一個備援；ERNIE 試用結束（空回應＋限流太頻繁）。
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
  let lastErr = { error: 'AI 暫時沒回應，請稍後再試', status: 502 };
  for (const model of MODELS) {
    const p = { ...payload, model };
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
          body: JSON.stringify(p),
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        lastErr = { error: 'AI 連線失敗，請稍後再試', status: 502 };
        break;
      }
      // 上游 429 是短暫突發限流：第一次先等 1.5 秒重試一次，不要直接說沒額度
      if (upstream.status === 429 && attempt === 0) {
        await sleep(UPSTREAM_RETRY_DELAY_MS);
        continue;
      }
      if (!upstream.ok) {
        if (upstream.status === 429) { lastErr = { error: '現在問的人有點多，等一下再問。', status: 429 }; break; }
        lastErr = { error: 'AI 暫時沒回應，請稍後再試', status: 502 };
        break;
      }
      const data = await upstream.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) { lastErr = { error: '有點問題，等吧！我去問我大哥榮德..', status: 502 }; break; }
      return { reply };
    }
  }
  return lastErr;
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
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  });
  if (result.reply) return json({ reply: toTraditional(result.reply) });
  return json({ error: result.error }, result.status);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
}
