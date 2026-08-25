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
function parseDestinationAddress(rawText) {
    if (!rawText || !rawText.trim()) return { city: '', district: '', cleanDist: '', raw: '' };
    const text = rawText.trim();

    const cityMatch = text.match(/(台北市|新北市|基隆市|桃園市|新竹市|新竹縣|苗栗縣|台中市|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|台南市|高雄市|屏東縣|屏東市|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|連江縣)/);
    const city = cityMatch ? cityMatch[1] : '';

    let textAfterCity = city ? text.replace(city, '').trim() : text;

    let district = '';
    const distMatch = textAfterCity.match(/^([^\s,市縣0-9]{1,4}?(?:區|鄉|鎮))/);
    if (distMatch) {
        district = distMatch[1];
    } else {
        const distMatch2 = textAfterCity.match(/([^\s,市縣0-9]{1,3}(?:區|鄉|鎮))/);
        if (distMatch2) {
            district = distMatch2[1];
        } else {
            const cityDistMatch = textAfterCity.match(/^([^\s,0-9]{1,3}市)(?![路街])/);
            if (cityDistMatch) district = cityDistMatch[1];
        }
    }

    let cleanDist = district ? district.replace(/[區鄉鎮市]$/, '') : '';

    if (!cleanDist) {
        const commonDistricts = [
            '楠梓', '鳳山', '三民', '苓雅', '左營', '小港', '前鎮', '鼓山', '岡山', '旗津', '林園', '大樹', '燕巢', '梓官', '橋頭', '仁武', '大社', '鳥松', '路竹', '阿蓮', '美濃', '旗山', '內門', '湖內',
            '屏東', '潮州', '恆春', '萬丹', '東港', '新園', '崁頂', '竹田', '麟洛', '萬巒', '內埔', '里港', '高樹', '九如', '鹽埔', '長治',
            '板橋', '新莊', '中和', '永和', '三重', '淡水', '汐止', '新店', '土城', '蘆洲', '樹林', '鶯歌', '三峽', '五股', '泰山', '林口', '八里', '三芝', '石門', '金山', '萬里',
            '士林', '內湖', '南港', '文山', '信義', '大安', '中山', '松山', '北投', '萬華', '大同', '中正',
            '西屯', '北屯', '南屯', '大里', '太平', '豐原', '沙鹿', '清水', '潭子', '大雅',
            '中壢', '桃園', '平鎮', '八德', '楊梅', '蘆竹', '龜山',
            '永康', '安南', '安平', '新化', '歸仁', '仁德', '善化', '新營'
        ];
        for (const cd of commonDistricts) {
            if (text.includes(cd)) {
                cleanDist = cd;
                district = cd;
                break;
            }
        }
    }

    return {
        raw: text,
        city: city,
        district: district,
        cleanDist: cleanDist
    };
}

function getSmartStoreRecommendations(dataStore, addressStr) {
    const parsed = parseDestinationAddress(addressStr);
    if (!parsed.cleanDist && !parsed.city && !parsed.raw) return { parsed, topStore: null, alternatives: [] };

    const storesMap = dataStore.stores || {};
    const contacts = dataStore.contacts || [];

    const candidates = [];

    contacts.forEach(c => {
        if (c.category && c.category.includes('MD')) return;
        const storeName = c['店名'] || '';
        const storeCode = c['代碼'] || '';
        const storeAddress = c['地址'] || '';
        const codeMatch = storeName.match(/^[A-Za-z]{2,3}/);
        const lookupKey = (codeMatch ? codeMatch[0] : (storeCode || storeName)).toUpperCase();
        const freightData = storesMap[lookupKey] || storesMap[storeName] || null;

        let feeAmount = Infinity;
        let feeRaw = '';
        let matchedAreaText = '';
        let isLocalStore = false;

        // Check if store is located in the exact same district
        if (parsed.cleanDist && storeAddress.includes(parsed.cleanDist)) {
            isLocalStore = true;
            feeAmount = 0;
            feeRaw = '$0 (同區在地門市)';
        }

        // Check freight table
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

        const isSameCity = parsed.city && storeAddress.includes(parsed.city.slice(0, 2));

        if (feeAmount !== Infinity || isLocalStore || isSameCity) {
            candidates.push({
                contact: c,
                freightData: freightData,
                feeAmount: feeAmount === Infinity ? 9999 : feeAmount,
                feeRaw: feeRaw || (isLocalStore ? '$0 (同區直出)' : '洽詢門市'),
                matchedAreaText: matchedAreaText,
                isLocalStore: isLocalStore,
                isSameCity: isSameCity
            });
        }
    });

    candidates.sort((a, b) => {
        if (a.isLocalStore && !b.isLocalStore) return -1;
        if (!a.isLocalStore && b.isLocalStore) return 1;
        return a.feeAmount - b.feeAmount;
    });

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

// 測試智慧選店推薦：屏東市
const rec2 = getSmartStoreRecommendations(realDataStore, '屏東縣屏東市自由路100號');
assert.ok(rec2.topStore, "應推薦屏東市出貨門市");
assert.strictEqual(rec2.topStore.isLocalStore, true);
console.log(`✅ Test 11: 智慧選店推薦「屏東市」通過 (首選: ${rec2.topStore.contact['店名']}, 運費: ${rec2.topStore.feeRaw})`);

// 測試智慧選店推薦：新北汐止
const rec3 = getSmartStoreRecommendations(realDataStore, '新北市汐止區新台五路一段');
assert.ok(rec3.topStore, "應推薦汐止出貨門市");
assert.strictEqual(rec3.topStore.isLocalStore, true);
console.log(`✅ Test 12: 智慧選店推薦「新北汐止」通過 (首選: ${rec3.topStore.contact['店名']}, 運費: ${rec3.topStore.feeRaw})`);

console.log("🎉 所有 12 項真實試算表與智慧選店測試 100% 全部通過！");
