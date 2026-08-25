// test-store-directory.js
const assert = require('assert');
const fs = require('fs');

// 讀取真實試算表產出的 store_data.json
const realDataStore = JSON.parse(fs.readFileSync('store_data.json', 'utf8'));

function parseSafeFreightFee(feeVal) {
    if (feeVal === null || feeVal === undefined) return { raw: '0', amount: 0, isFree: true };
    const str = String(feeVal).trim();
    if (str === '0' || str === '$0' || str === '免運' || str === '免費' || str === '0元') {
        return { raw: '$0 免運', amount: 0, isFree: true };
    }
    const match = str.match(/[0-9,]+/);
    const num = match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    return { raw: `$${num.toLocaleString()}`, amount: num, isFree: num === 0 };
}

function searchDirectory(dataStore, query, activeTab) {
    const q = String(query || '').toLowerCase().trim();
    const results = {
        stores: [],
        mdList: []
    };

    if (!dataStore) return results;

    const contacts = dataStore.contacts || [];
    const storesMap = dataStore.stores || {};

    // 1. 門市及跨店 (含運費目的地) 與家電 MD 過濾
    contacts.forEach(c => {
        const isMD = c.category && c.category.includes('MD');
        const name = String(c['店名'] || c['部門'] || '').toLowerCase();
        const code = String(c['代碼'] || '').toLowerCase();
        const phone = String(c['電話'] || c['課長電話'] || c['助理電話'] || '').toLowerCase();
        const allStaffStr = [c['店長'], c['處長'], c['課長'], c['助理'], c['負責人'], c['部門']].filter(Boolean).join(' ').toLowerCase();
        const address = String(c['地址'] || '').toLowerCase();

        const codeMatch = name.match(/^[A-Za-z]{2,3}/);
        const lookupKey = (codeMatch ? codeMatch[0] : (code || name)).toUpperCase();
        const freightData = storesMap[lookupKey] || storesMap[c['店名']] || null;
        const freightMatch = q && freightData && (freightData.fees || []).some(f => (String(f.area || '') + ' ' + String(f.fee || '')).toLowerCase().includes(q));

        const match = !q || name.includes(q) || code.includes(q) || phone.includes(q) || allStaffStr.includes(q) || address.includes(q) || freightMatch;

        if (match) {
            if (isMD) {
                if (activeTab === 'all' || activeTab === 'md') {
                    results.mdList.push(c);
                }
            } else {
                if (activeTab === 'all' || activeTab === 'stores') {
                    results.stores.push({
                        ...c,
                        _freightData: freightData
                    });
                }
            }
        }
    });

    return results;
}

console.log("=== 開始執行真實試算表資料檢索測試 ===");

// 測試真實資料總筆數
assert.strictEqual(realDataStore.contacts.length, 83);
assert.strictEqual(Object.keys(realDataStore.stores).length, 59);
console.log("✅ Test 1: 真實資料庫結構驗證 (83 筆聯絡人, 59 家門市跨區運費)");

// 搜尋 WG五甲
const resWG = searchDirectory(realDataStore, '五甲', 'all');
assert.ok(resWG.stores.length > 0, "應找到五甲門市聯絡資訊");
assert.ok(resWG.stores[0]._freightData && resWG.stores[0]._freightData.fees.length > 0, "五甲門市卡片應整合運費表");
console.log(`✅ Test 2: 真實店名搜尋「五甲」通過 (找到 ${resWG.stores[0]['店名']}, 整合 ${resWG.stores[0]._freightData.fees.length} 區運費)`);

// 搜尋 天母 (022)
const resTM = searchDirectory(realDataStore, '022', 'all');
assert.ok(resTM.stores.length > 0, "應依店碼 022 找到天母門市");
console.log(`✅ Test 3: 店碼搜尋「022」通過 (找到 ${resTM.stores[0]['店名']})`);

// 搜尋 40MD 家電
const resMD = searchDirectory(realDataStore, '40MD', 'all');
assert.ok(resMD.mdList.length > 0, "應找到 40MD 家電負責人");
console.log(`✅ Test 4: 家電 MD 搜尋「40MD」通過 (找到 ${resMD.mdList[0]['負責人']})`);

// 搜尋 目的地區域 恆春 (在「門市及跨店」整合標籤下直接搜尋)
const resHengchun = searchDirectory(realDataStore, '恆春', 'stores');
assert.ok(resHengchun.stores.length > 0, "應在門市及跨店名錄中直接找到送達恆春的門市");
console.log(`✅ Test 5: 目的地區域反查「恆春」通過 (在門市及跨店中找到 ${resHengchun.stores.length} 家可送達門市)`);

// 運費解析測試
const parsed = parseSafeFreightFee('$1,500');
assert.strictEqual(parsed.amount, 1500);
assert.strictEqual(parsed.raw, '$1,500');
assert.strictEqual(parsed.isFree, false);
console.log("✅ Test 6: 千分位運費解析 ($1,500) 通過");

// 處長與課長 Email 解析測試
function parseStaffContact(rawStr) {
    if (!rawStr || !rawStr.trim()) return { name: '', email: '', note: '' };
    const str = rawStr.trim();
    const emailMatch = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
    const email = emailMatch ? emailMatch[0].trim() : '';

    let textWithoutEmail = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '');
    const lines = textWithoutEmail.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    
    let name = '';
    let notes = [];
    
    lines.forEach((line, idx) => {
        if (idx === 0 && !line.startsWith('(') && !line.startsWith('<')) {
            name = line;
        } else {
            notes.push(line);
        }
    });

    if (!name && lines.length > 0) {
        name = lines[0];
        notes = lines.slice(1);
    }

    return {
        name: name || (email ? email.split('@')[0] : ''),
        email: email,
        note: notes.join(' ')
    };
}

// 測試天母課長 Email 解析
const tmContact = realDataStore.contacts.find(c => c['店名'] === 'TM天母');
assert.ok(tmContact, "應找到天母門市");
const tmSec = parseStaffContact(tmContact['課長']);
assert.strictEqual(tmSec.email, 'steven_yang@uni-prosperity.com.tw');
assert.ok(tmSec.name.includes('Steven YANG 楊風吟'));

// 測試五甲處長與課長 Email 解析
const wgContact = realDataStore.contacts.find(c => c['店名'] === 'WG五甲');
assert.ok(wgContact, "應找到五甲門市");
const wgDir = parseStaffContact(wgContact['處長']);
const wgSec = parseStaffContact(wgContact['課長']);
assert.strictEqual(wgDir.email, 'cathy_tseng@uni-prosperity.com.tw');
assert.strictEqual(wgSec.email, 'jung_te_huang@uni-Prosperity.com.tw');
console.log("✅ Test 7: 處長與課長 Email 精準解析提取通過");

// 測試以 Email 關鍵字進行門市搜尋
const resEmailSearch = searchDirectory(realDataStore, 'steven_yang', 'all');
assert.ok(resEmailSearch.stores.length > 0, "應依 email 關鍵字找到天母門市");
assert.strictEqual(resEmailSearch.stores[0]['店名'], 'TM天母');
console.log("✅ Test 8: Email 關鍵字即時反查門市通過 (找到 TM天母)");

// -------------------------------------------------------------
// 智慧跨店選店推薦演算法 (Smart Store Dispatch & Recommender Engine)
// -------------------------------------------------------------
const TAIWAN_GEO_ZIP_MAP = {
    // 台北市
    '100': { city: '台北市', district: '中正區', cleanDist: '中正', lat: 25.032, lon: 121.518 },
    '103': { city: '台北市', district: '大同區', cleanDist: '大同', lat: 25.063, lon: 121.513 },
    '104': { city: '台北市', district: '中山區', cleanDist: '中山', lat: 25.068, lon: 121.533 },
    '105': { city: '台北市', district: '松山區', cleanDist: '松山', lat: 25.059, lon: 121.557 },
    '106': { city: '台北市', district: '大安區', cleanDist: '大安', lat: 25.026, lon: 121.543 },
    '108': { city: '台北市', district: '萬華區', cleanDist: '萬華', lat: 25.035, lon: 121.499 },
    '110': { city: '台北市', district: '信義區', cleanDist: '信義', lat: 25.033, lon: 121.565 },
    '111': { city: '台北市', district: '士林區', cleanDist: '士林', lat: 25.092, lon: 121.524 },
    '112': { city: '台北市', district: '北投區', cleanDist: '北投', lat: 25.132, lon: 121.498 },
    '114': { city: '台北市', district: '內湖區', cleanDist: '內湖', lat: 25.083, lon: 121.594 },
    '115': { city: '台北市', district: '南港區', cleanDist: '南港', lat: 25.038, lon: 121.611 },
    '116': { city: '台北市', district: '文山區', cleanDist: '文山', lat: 24.989, lon: 121.570 },

    // 新北市
    '207': { city: '新北市', district: '萬里區', cleanDist: '萬里', lat: 25.178, lon: 121.689 },
    '208': { city: '新北市', district: '金山區', cleanDist: '金山', lat: 25.222, lon: 121.638 },
    '220': { city: '新北市', district: '板橋區', cleanDist: '板橋', lat: 25.014, lon: 121.462 },
    '221': { city: '新北市', district: '汐止區', cleanDist: '汐止', lat: 25.063, lon: 121.658 },
    '222': { city: '新北市', district: '深坑區', cleanDist: '深坑', lat: 25.002, lon: 121.615 },
    '223': { city: '新北市', district: '石碇區', cleanDist: '石碇', lat: 24.991, lon: 121.659 },
    '224': { city: '新北市', district: '瑞芳區', cleanDist: '瑞芳', lat: 25.109, lon: 121.810 },
    '231': { city: '新北市', district: '新店區', cleanDist: '新店', lat: 24.968, lon: 121.541 },
    '234': { city: '新北市', district: '永和區', cleanDist: '永和', lat: 25.008, lon: 121.515 },
    '235': { city: '新北市', district: '中和區', cleanDist: '中和', lat: 24.999, lon: 121.497 },
    '236': { city: '新北市', district: '土城區', cleanDist: '土城', lat: 24.972, lon: 121.443 },
    '237': { city: '新北市', district: '三峽區', cleanDist: '三峽', lat: 24.934, lon: 121.370 },
    '238': { city: '新北市', district: '樹林區', cleanDist: '樹林', lat: 24.991, lon: 121.424 },
    '239': { city: '新北市', district: '鶯歌區', cleanDist: '鶯歌', lat: 24.954, lon: 121.355 },
    '241': { city: '新北市', district: '三重區', cleanDist: '三重', lat: 25.071, lon: 121.494 },
    '242': { city: '新北市', district: '新莊區', cleanDist: '新莊', lat: 25.036, lon: 121.450 },
    '243': { city: '新北市', district: '泰山區', cleanDist: '泰山', lat: 25.059, lon: 121.431 },
    '244': { city: '新北市', district: '林口區', cleanDist: '林口', lat: 25.077, lon: 121.391 },
    '247': { city: '新北市', district: '蘆洲區', cleanDist: '蘆洲', lat: 25.085, lon: 121.474 },
    '248': { city: '新北市', district: '五股區', cleanDist: '五股', lat: 25.083, lon: 121.438 },
    '249': { city: '新北市', district: '八里區', cleanDist: '八里', lat: 25.147, lon: 121.398 },
    '251': { city: '新北市', district: '淡水區', cleanDist: '淡水', lat: 25.176, lon: 121.442 },
    '252': { city: '新北市', district: '三芝區', cleanDist: '三芝', lat: 25.258, lon: 121.501 },
    '253': { city: '新北市', district: '石門區', cleanDist: '石門', lat: 25.291, lon: 121.568 },

    // 基隆市
    '200': { city: '基隆市', district: '仁愛區', cleanDist: '仁愛', lat: 25.128, lon: 121.741 },
    '201': { city: '基隆市', district: '信義區', cleanDist: '基隆信義', lat: 25.130, lon: 121.761 },
    '202': { city: '基隆市', district: '中正區', cleanDist: '基隆中正', lat: 25.150, lon: 121.768 },
    '204': { city: '基隆市', district: '安樂區', cleanDist: '安樂', lat: 25.138, lon: 121.714 },

    // 桃園市
    '320': { city: '桃園市', district: '中壢區', cleanDist: '中壢', lat: 24.965, lon: 121.225 },
    '324': { city: '桃園市', district: '平鎮區', cleanDist: '平鎮', lat: 24.945, lon: 121.218 },
    '325': { city: '桃園市', district: '龍潭區', cleanDist: '龍潭', lat: 24.863, lon: 121.216 },
    '326': { city: '桃園市', district: '楊梅區', cleanDist: '楊梅', lat: 24.908, lon: 121.146 },
    '330': { city: '桃園市', district: '桃園區', cleanDist: '桃園', lat: 24.993, lon: 121.301 },
    '333': { city: '桃園市', district: '龜山區', cleanDist: '龜山', lat: 24.996, lon: 121.338 },
    '334': { city: '桃園市', district: '八德區', cleanDist: '八德', lat: 24.938, lon: 121.284 },
    '338': { city: '桃園市', district: '蘆竹區', cleanDist: '蘆竹', lat: 25.045, lon: 121.293 },

    // 新竹
    '300': { city: '新竹市', district: '東區', cleanDist: '新竹東區', lat: 24.797, lon: 120.987 },
    '302': { city: '新竹縣', district: '竹北市', cleanDist: '竹北', lat: 24.838, lon: 121.009 },

    // 台中市
    '400': { city: '台中市', district: '中區', cleanDist: '台中中區', lat: 24.142, lon: 120.683 },
    '401': { city: '台中市', district: '東區', cleanDist: '台中東區', lat: 24.136, lon: 120.693 },
    '402': { city: '台中市', district: '南區', cleanDist: '台中南區', lat: 24.120, lon: 120.662 },
    '403': { city: '台中市', district: '西區', cleanDist: '台中西區', lat: 24.143, lon: 120.663 },
    '404': { city: '台中市', district: '北區', cleanDist: '台中北區', lat: 24.161, lon: 120.683 },
    '406': { city: '台中市', district: '北屯區', cleanDist: '北屯', lat: 24.183, lon: 120.697 },
    '407': { city: '台中市', district: '西屯區', cleanDist: '西屯', lat: 24.162, lon: 120.640 },
    '408': { city: '台中市', district: '南屯區', cleanDist: '南屯', lat: 24.137, lon: 120.638 },
    '411': { city: '台中市', district: '太平區', cleanDist: '太平', lat: 24.127, lon: 120.718 },
    '412': { city: '台中市', district: '大里區', cleanDist: '大里', lat: 24.099, lon: 120.687 },
    '420': { city: '台中市', district: '豐原區', cleanDist: '豐原', lat: 24.252, lon: 120.718 },
    '433': { city: '台中市', district: '沙鹿區', cleanDist: '沙鹿', lat: 24.233, lon: 120.563 },
    '436': { city: '台中市', district: '清水區', cleanDist: '清水', lat: 24.270, lon: 120.560 },

    // 台南市
    '700': { city: '台南市', district: '中西區', cleanDist: '中西區', lat: 22.992, lon: 120.199 },
    '701': { city: '台南市', district: '東區', cleanDist: '台南東區', lat: 22.986, lon: 120.224 },
    '702': { city: '台南市', district: '南區', cleanDist: '台南南區', lat: 22.960, lon: 120.194 },
    '704': { city: '台南市', district: '北區', cleanDist: '台南北區', lat: 23.007, lon: 120.207 },
    '708': { city: '台南市', district: '安平區', cleanDist: '安平', lat: 22.998, lon: 120.165 },
    '709': { city: '台南市', district: '安南區', cleanDist: '安南', lat: 23.048, lon: 120.185 },
    '710': { city: '台南市', district: '永康區', cleanDist: '永康', lat: 23.026, lon: 120.256 },
    '711': { city: '台南市', district: '歸仁區', cleanDist: '歸仁', lat: 22.967, lon: 120.293 },
    '717': { city: '台南市', district: '仁德區', cleanDist: '仁德', lat: 22.962, lon: 120.251 },
    '730': { city: '台南市', district: '新營區', cleanDist: '新營', lat: 23.310, lon: 120.316 },

    // 高雄市
    '800': { city: '高雄市', district: '新興區', cleanDist: '新興', lat: 22.631, lon: 120.306 },
    '801': { city: '高雄市', district: '前金區', cleanDist: '前金', lat: 22.627, lon: 120.295 },
    '802': { city: '高雄市', district: '苓雅區', cleanDist: '苓雅', lat: 22.628, lon: 120.315 },
    '803': { city: '高雄市', district: '鹽埕區', cleanDist: '鹽埕', lat: 22.625, lon: 120.284 },
    '804': { city: '高雄市', district: '鼓山區', cleanDist: '鼓山', lat: 22.658, lon: 120.278 },
    '805': { city: '高雄市', district: '旗津區', cleanDist: '旗津', lat: 22.569, lon: 120.292 },
    '806': { city: '高雄市', district: '前鎮區', cleanDist: '前鎮', lat: 22.589, lon: 120.318 },
    '807': { city: '高雄市', district: '三民區', cleanDist: '三民', lat: 22.653, lon: 120.317 },
    '811': { city: '高雄市', district: '楠梓區', cleanDist: '楠梓', lat: 22.729, lon: 120.326 },
    '812': { city: '高雄市', district: '小港區', cleanDist: '小港', lat: 22.565, lon: 120.337 },
    '813': { city: '高雄市', district: '左營區', cleanDist: '左營', lat: 22.689, lon: 120.294 },
    '814': { city: '高雄市', district: '仁武區', cleanDist: '仁武', lat: 22.701, lon: 120.348 },
    '815': { city: '高雄市', district: '大社區', cleanDist: '大社', lat: 22.730, lon: 120.347 },
    '820': { city: '高雄市', district: '岡山區', cleanDist: '岡山', lat: 22.796, lon: 120.296 },
    '821': { city: '高雄市', district: '路竹區', cleanDist: '路竹', lat: 22.856, lon: 120.261 },
    '822': { city: '高雄市', district: '阿蓮區', cleanDist: '阿蓮', lat: 22.883, lon: 120.327 },
    '824': { city: '高雄市', district: '燕巢區', cleanDist: '燕巢', lat: 22.793, lon: 120.362 },
    '825': { city: '高雄市', district: '橋頭區', cleanDist: '橋頭', lat: 22.757, lon: 120.305 },
    '826': { city: '高雄市', district: '梓官區', cleanDist: '梓官', lat: 22.760, lon: 120.267 },
    '827': { city: '高雄市', district: '彌陀區', cleanDist: '彌陀', lat: 22.783, lon: 120.241 },
    '828': { city: '高雄市', district: '永安區', cleanDist: '永安', lat: 22.818, lon: 120.226 },
    '830': { city: '高雄市', district: '鳳山區', cleanDist: '鳳山', lat: 22.626, lon: 120.357 },
    '831': { city: '高雄市', district: '大寮區', cleanDist: '大寮', lat: 22.605, lon: 120.395 },
    '832': { city: '高雄市', district: '林園區', cleanDist: '林園', lat: 22.505, lon: 120.395 },
    '833': { city: '高雄市', district: '鳥松區', cleanDist: '鳥松', lat: 22.659, lon: 120.364 },
    '840': { city: '高雄市', district: '大樹區', cleanDist: '大樹', lat: 22.693, lon: 120.433 },
    '842': { city: '高雄市', district: '旗山區', cleanDist: '旗山', lat: 22.888, lon: 120.481 },
    '843': { city: '高雄市', district: '美濃區', cleanDist: '美濃', lat: 22.898, lon: 120.542 },

    // 屏東縣
    '900': { city: '屏東縣', district: '屏東市', cleanDist: '屏東', lat: 22.676, lon: 120.488 },
    '907': { city: '屏東縣', district: '鹽埔鄉', cleanDist: '鹽埔', lat: 22.753, lon: 120.573 },
    '908': { city: '屏東縣', district: '長治鄉', cleanDist: '長治', lat: 22.677, lon: 120.528 },
    '909': { city: '屏東縣', district: '麟洛鄉', cleanDist: '麟洛', lat: 22.651, lon: 120.527 },
    '911': { city: '屏東縣', district: '竹田鄉', cleanDist: '竹田', lat: 22.585, lon: 120.543 },
    '912': { city: '屏東縣', district: '內埔鄉', cleanDist: '內埔', lat: 22.615, lon: 120.567 },
    '913': { city: '屏東縣', district: '萬丹鄉', cleanDist: '萬丹', lat: 22.590, lon: 120.488 },
    '920': { city: '屏東縣', district: '潮州鎮', cleanDist: '潮州', lat: 22.550, lon: 120.542 },
    '928': { city: '屏東縣', district: '東港鎮', cleanDist: '東港', lat: 22.467, lon: 120.453 },
    '946': { city: '屏東縣', district: '恆春鎮', cleanDist: '恆春', lat: 22.004, lon: 120.744 }
};

function calculateGeoDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

function resolveLocationInfo(addressText) {
    if (!addressText) return null;
    const text = String(addressText).trim();
    
    const zipMatch = text.match(/^(\d{3})/);
    if (zipMatch && TAIWAN_GEO_ZIP_MAP[zipMatch[1]]) {
        return TAIWAN_GEO_ZIP_MAP[zipMatch[1]];
    }

    for (const zip of Object.keys(TAIWAN_GEO_ZIP_MAP)) {
        const item = TAIWAN_GEO_ZIP_MAP[zip];
        if (text.includes(item.district) || (item.cleanDist.length >= 2 && text.includes(item.cleanDist))) {
            return item;
        }
    }

    return null;
}

function parseDestinationAddress(rawText) {
    if (!rawText || !rawText.trim()) return { city: '', district: '', cleanDist: '', raw: '', loc: null };
    const text = rawText.trim();

    const loc = resolveLocationInfo(text);
    if (loc) {
        return {
            raw: text,
            city: loc.city,
            district: loc.district,
            cleanDist: loc.cleanDist,
            loc: loc
        };
    }

    const cityMatch = text.match(/(台北|新北|基隆|桃園|新竹|苗栗|台中|彰化|南投|雲林|嘉義|台南|高雄|屏東|宜蘭|花蓮|台東|澎湖|金門|連江)(?:市|縣)?/);
    const city = cityMatch ? (cityMatch[1] + (['台北', '新北', '基隆', '桃園', '新竹', '台中', '嘉義', '台南', '高雄'].includes(cityMatch[1]) ? '市' : '縣')) : '';
    let textAfterCity = cityMatch ? text.replace(cityMatch[0], '').trim() : text;
    let distMatch = textAfterCity.match(/^([^\s,市縣0-9]{1,4}?(?:區|鄉|鎮|市))/);
    let district = distMatch ? distMatch[1] : '';
    let cleanDist = district.replace(/[區鄉鎮市]$/, '');

    return {
        raw: text,
        city: city,
        district: district,
        cleanDist: cleanDist,
        loc: null
    };
}

function getSmartStoreRecommendations(dataStore, addressStr) {
    const parsed = parseDestinationAddress(addressStr);
    if (!parsed.cleanDist && !parsed.city && !parsed.raw) return { parsed, topStore: null, alternatives: [] };

    const storesMap = dataStore.stores || {};
    const contacts = dataStore.contacts || [];

    const destLoc = parsed.loc;
    const candidates = [];

    contacts.forEach(c => {
        if (c.category && c.category.includes('MD')) return;
        const storeName = c['店名'] || '';
        const storeCode = c['代碼'] || '';
        const storeAddress = c['地址'] || '';
        const storeLoc = resolveLocationInfo(storeAddress);

        const codeMatch = storeName.match(/^[A-Za-z]{2,3}/);
        const lookupKey = (codeMatch ? codeMatch[0] : (storeCode || storeName)).toUpperCase();
        const freightData = storesMap[lookupKey] || storesMap[storeName] || null;

        const distKm = (destLoc && storeLoc) ? calculateGeoDistanceKm(destLoc.lat, destLoc.lon, storeLoc.lat, storeLoc.lon) : null;

        let isLocalStore = false;
        if (parsed.cleanDist && (storeAddress.includes(parsed.cleanDist) || (storeLoc && storeLoc.cleanDist === parsed.cleanDist))) {
            isLocalStore = true;
        }

        let feeAmount = Infinity;
        let feeRaw = '';
        let matchedAreaText = '';

        if (freightData && freightData.fees && parsed.cleanDist) {
            freightData.fees.forEach(f => {
                const areaStr = String(f.area || '');
                if (areaStr.includes(parsed.cleanDist)) {
                    const match = String(f.fee || '').match(/[0-9,]+/);
                    const num = match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
                    if (num < feeAmount) {
                        feeAmount = num;
                        feeRaw = f.fee;
                        matchedAreaText = f.area;
                    }
                }
            });
        }

        const isSameCity = (parsed.city && storeAddress.includes(parsed.city.slice(0, 2))) || (destLoc && storeLoc && destLoc.city === storeLoc.city);

        if (isLocalStore || feeAmount !== Infinity || isSameCity || distKm !== null) {
            let sortScore = 0;
            if (isLocalStore) {
                sortScore = 100;
            } else if (distKm !== null && distKm < 8) {
                sortScore = 200 + distKm;
            } else if (feeAmount !== Infinity) {
                sortScore = 300 + feeAmount;
            } else if (distKm !== null) {
                sortScore = 400 + distKm;
            } else {
                sortScore = 900;
            }

            candidates.push({
                contact: c,
                freightData: freightData,
                distKm: distKm,
                feeAmount: feeAmount === Infinity ? (isLocalStore ? 0 : 9999) : feeAmount,
                feeRaw: feeRaw || (isLocalStore ? '$0 (同區在地門市)' : (distKm !== null ? '約 ' + distKm + ' km (鄰近門市)' : '洽詢門市')),
                matchedAreaText: matchedAreaText,
                isLocalStore: isLocalStore,
                isSameCity: isSameCity,
                sortScore: sortScore
            });
        }
    });

    candidates.sort((a, b) => a.sortScore - b.sortScore);

    return {
        parsed: parsed,
        topStore: candidates.length > 0 ? candidates[0] : null,
        alternatives: candidates.slice(1)
    };
}

// 測試地址解析 (高雄市楠梓區藍昌路300號)
const p1 = parseDestinationAddress('高雄市楠梓區藍昌路300號');
assert.strictEqual(p1.city, '高雄市');
assert.strictEqual(p1.district, '楠梓區');
assert.strictEqual(p1.cleanDist, '楠梓');
console.log("✅ Test 9: 智慧地址解析 (高雄楠梓) 通過");

// 測試智慧選店推薦：高雄楠梓
const rec1 = getSmartStoreRecommendations(realDataStore, '高雄市楠梓區藍昌路300號');
assert.ok(rec1.topStore, "應推薦出貨門市");
assert.ok(rec1.topStore.contact['店名'].includes('楠梓') || rec1.topStore.contact['店名'].includes('新楠') || rec1.topStore.isLocalStore, "首選應為同區在地門市");
assert.ok(rec1.alternatives.length > 0, "應有跨店外送備選門市");
console.log(`✅ Test 10: 智慧選店推薦「高雄楠梓」通過 (首選: ${rec1.topStore.contact['店名']}, 備選 ${rec1.alternatives.length} 家)`);

// 測試智慧選店推薦：高雄苓雅區和平二路 (必須精準推薦南高雄近鄰門市，絕對不可推北高雄楠梓！)
const recLingya = getSmartStoreRecommendations(realDataStore, '高雄苓雅區和平二路');
assert.ok(recLingya.topStore, "應推薦苓雅區鄰近出貨門市");
assert.ok(!recLingya.topStore.contact['店名'].includes('楠梓'), "苓雅區絕對不可誤推薦遠在北高雄的楠梓店");
assert.ok(['LR愛河', 'DS鼎山', 'CG澄清', 'WG五甲', 'ZK成功', 'FS鳳山', 'KH光華'].includes(recLingya.topStore.contact['店名']), "首選必須為南高雄鄰近門市 (2~4km)");
console.log(`✅ Test 11: 智慧選店推薦「高雄苓雅區和平二路」通過 (精準首選: ${recLingya.topStore.contact['店名']}, 距離: ${recLingya.topStore.distKm} km)`);

// 測試智慧選店推薦：屏東市
const rec2 = getSmartStoreRecommendations(realDataStore, '屏東縣屏東市自由路100號');
assert.ok(rec2.topStore, "應推薦屏東市出貨門市");
assert.strictEqual(rec2.topStore.isLocalStore, true);
console.log(`✅ Test 12: 智慧選店推薦「屏東市」通過 (首選: ${rec2.topStore.contact['店名']}, 運費: ${rec2.topStore.feeRaw})`);

// 測試智慧選店推薦：新北汐止
const rec3 = getSmartStoreRecommendations(realDataStore, '新北市汐止區新台五路一段');
assert.ok(rec3.topStore, "應推薦汐止出貨門市");
assert.strictEqual(rec3.topStore.isLocalStore, true);
console.log(`✅ Test 13: 智慧選店推薦「新北汐止」通過 (首選: ${rec3.topStore.contact['店名']}, 運費: ${rec3.topStore.feeRaw})`);

console.log("🎉 所有 13 項真實試算表與智慧選店測試 100% 全部通過！");
