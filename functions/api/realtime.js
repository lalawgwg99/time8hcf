// TIME 8 即時查詢：新聞（Google News RSS）＋天氣（Open-Meteo），免費、免 key。
// 只回伺服器端抓到的事實，絕不編造；上游掛了就回通用錯誤，不洩漏細節。
// 天氣 in-memory 快取 10 分鐘；新聞不快取（RSS 本身就是最新的）。

const RATE_LIMIT = 60; // 每 IP 每 10 分鐘最多 60 次（v2.12.3：使用者連續測試＋泡泡天氣抓取共用，放寬）
const RATE_WINDOW_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const WEATHER_CACHE_MS = 10 * 60 * 1000;
const NEWS_MAX = 8;
const NEWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const YAHOO_RSS = 'https://tw.news.yahoo.com/rss';

const CITIES = {
  '台北': [25.03, 121.56], '新北': [25.01, 121.46], '桃園': [24.99, 121.30],
  '新竹': [24.80, 120.97], '台中': [24.14, 120.68], '嘉義': [23.48, 120.45],
  '台南': [22.99, 120.21], '高雄': [22.62, 120.31], '基隆': [25.13, 121.74],
  '宜蘭': [24.75, 121.75], '花蓮': [23.97, 121.60], '台東': [22.75, 121.15],
  '澎湖': [23.57, 119.58], '金門': [24.44, 118.38], '馬祖': [26.16, 119.95],
};

// WMO 天氣代碼 → 繁中
const WMO = {
  0: '晴天', 1: '大致晴朗', 2: '多雲', 3: '陰天',
  45: '霧', 48: '霧淞', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨',
  56: '凍毛毛雨', 57: '凍毛毛雨', 61: '小雨', 63: '雨', 65: '大雨',
  66: '凍雨', 67: '凍雨', 71: '小雪', 73: '雪', 75: '大雪',
  77: '雪粒', 80: '陣雨', 81: '陣雨', 82: '強陣雨',
  85: '陣雪', 86: '陣雪', 95: '雷陣雨', 96: '雷陣雨伴冰雹', 99: '雷陣雨伴冰雹',
};

const hits = new Map(); // ip -> [timestamps]，isolate 內 best-effort 限流
const weatherCache = new Map(); // city -> { at, body }

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

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function tagText(block, tag) {
  const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const cd = v.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cd) v = cd[1];
  return decodeEntities(v).trim();
}

// Google News RSS 的標題尾巴是「 - 來源」，拆開顯示
function splitTitle(raw) {
  const m = raw.match(/^(.*?)\s+-\s+([^-]{1,30})$/);
  if (m) return { title: m[1].trim(), source: m[2].trim() };
  return { title: raw, source: '' };
}

function parseNewsRss(xml, defaultSource) {
  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const rawTitle = tagText(b, 'title');
    if (!rawTitle) continue;
    const { title, source } = splitTitle(rawTitle);
    const link = tagText(b, 'link');
    const pub = tagText(b, 'pubDate');
    let time = '';
    if (pub) {
      const d = new Date(pub);
      if (!isNaN(d.getTime())) time = d.toISOString();
    }
    items.push({ title, source: source || defaultSource || '', time, link });
    if (items.length >= NEWS_MAX) break;
  }
  return items;
}

async function fetchRssText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': NEWS_UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('rss upstream ' + res.status);
  return res.text();
}

// Google News 優先；Workers 出口 IP 被 Google 擋時退到 Yahoo 奇摩（只有頭條、無搜尋）
async function fetchNews(q) {
  const googleUrl = q
    ? 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=zh-TW&gl=TW&ceid=TW:zh-Hant'
    : 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
  try {
    const items = parseNewsRss(await fetchRssText(googleUrl), 'Google 新聞');
    if (items.length) return { items, source: 'Google News', query: q || null };
  } catch (e) { /* 掉到備援 */ }
  const items = parseNewsRss(await fetchRssText(YAHOO_RSS), 'Yahoo奇摩新聞');
  if (!items.length) throw new Error('yahoo empty');
  return { items, source: 'Yahoo奇摩新聞', query: null };
}

function wmoDesc(code) {
  return WMO[code] || '未知天氣';
}

async function fetchWeather(city) {
  const cached = weatherCache.get(city);
  if (cached && Date.now() - cached.at < WEATHER_CACHE_MS) return cached.body;
  const [lat, lon] = CITIES[city] || CITIES['高雄'];
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=Asia%2FTaipei&forecast_days=2';
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error('weather upstream ' + res.status);
  const d = await res.json();
  const cur = d.current || {};
  const daily = d.daily || {};
  const day = (i) => ({
    date: (daily.time || [])[i] || '',
    code: (daily.weather_code || [])[i],
    desc: wmoDesc((daily.weather_code || [])[i]),
    max: (daily.temperature_2m_max || [])[i],
    min: (daily.temperature_2m_min || [])[i],
    rainChance: (daily.precipitation_probability_max || [])[i],
  });
  const body = {
    kind: 'weather',
    city,
    fetchedAt: new Date().toISOString(),
    current: {
      time: cur.time || '',
      temp: cur.temperature_2m,
      feelsLike: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      wind: cur.wind_speed_10m,
      code: cur.weather_code,
      desc: wmoDesc(cur.weather_code),
    },
    today: day(0),
    tomorrow: day(1),
  };
  weatherCache.set(city, { at: Date.now(), body });
  return body;
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') || '';
  if (kind !== 'news' && kind !== 'weather') return json({ error: 'kind 必須是 news 或 weather' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (rateLimited(ip)) return json({ error: '問太快了，休息一下再問' }, 429);

  try {
    if (kind === 'news') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 30);
      const { items, source, query } = await fetchNews(q || null);
      return json({ kind: 'news', query, source, fetchedAt: new Date().toISOString(), items });
    }
    const city = (url.searchParams.get('city') || '高雄').trim();
    const name = CITIES[city] ? city : '高雄';
    const body = await fetchWeather(name);
    return json(body);
  } catch {
    return json({ error: '即時查詢暫時連不上，請稍後再試' }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS' } });
}
