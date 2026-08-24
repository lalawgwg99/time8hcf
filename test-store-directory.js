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
        mdList: [],
        freightMatches: []
    };

    if (!dataStore) return results;

    const contacts = dataStore.contacts || [];
    const storesMap = dataStore.stores || {};

    // 1. 門市與聯絡人過濾
    contacts.forEach(c => {
        const isMD = c.category && c.category.includes('MD');
        const name = String(c['店名'] || c['部門'] || '').toLowerCase();
        const code = String(c['代碼'] || '').toLowerCase();
        const phone = String(c['電話'] || c['課長電話'] || c['助理電話'] || '').toLowerCase();
        const allStaffStr = [c['店長'], c['處長'], c['課長'], c['助理'], c['負責人'], c['部門']].filter(Boolean).join(' ').toLowerCase();
        const address = String(c['地址'] || '').toLowerCase();

        const match = !q || name.includes(q) || code.includes(q) || phone.includes(q) || allStaffStr.includes(q) || address.includes(q);

        if (match) {
            if (isMD) {
                if (activeTab === 'all' || activeTab === 'md') {
                    results.mdList.push(c);
                }
            } else {
                if (activeTab === 'all' || activeTab === 'stores') {
                    results.stores.push(c);
                }
            }
        }
    });

    // 2. 跨店運費雙向過濾 (店名/代碼 OR 目的地區域)
    if (activeTab === 'all' || activeTab === 'freight') {
        Object.keys(storesMap).forEach(codeKey => {
            const storeObj = storesMap[codeKey];
            const storeCode = String(storeObj.code || codeKey).toLowerCase();
            const storeName = String(storeObj.name || '').toLowerCase();

            const isStoreMatch = q && (storeCode.includes(q) || storeName.includes(q));

            const matchedFees = (storeObj.fees || []).filter(f => {
                const area = String(f.area || '').toLowerCase();
                const feeText = String(f.fee || '').toLowerCase();
                if (!q) return true;
                if (isStoreMatch) return true;
                return area.includes(q) || feeText.includes(q);
            });

            if (matchedFees.length > 0) {
                results.freightMatches.push({
                    code: storeObj.code || codeKey,
                    name: storeObj.name || codeKey,
                    fees: matchedFees
                });
            }
        });
    }

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
assert.ok(resWG.freightMatches.length > 0, "應找到五甲門市運費表");
console.log(`✅ Test 2: 真實店名搜尋「五甲」通過 (找到 ${resWG.stores[0]['店名']})`);

// 搜尋 天母 (022)
const resTM = searchDirectory(realDataStore, '022', 'all');
assert.ok(resTM.stores.length > 0, "應依店碼 022 找到天母門市");
console.log(`✅ Test 3: 店碼搜尋「022」通過 (找到 ${resTM.stores[0]['店名']})`);

// 搜尋 40MD 家電
const resMD = searchDirectory(realDataStore, '40MD', 'all');
assert.ok(resMD.mdList.length > 0, "應找到 40MD 家電負責人");
console.log(`✅ Test 4: 家電 MD 搜尋「40MD」通過 (找到 ${resMD.mdList[0]['負責人']})`);

// 搜尋 目的地區域 恆春
const resHengchun = searchDirectory(realDataStore, '恆春', 'freight');
assert.ok(resHengchun.freightMatches.length > 0, "應找到送達恆春的門市運費");
console.log(`✅ Test 5: 目的地區域反查「恆春」通過 (共 ${resHengchun.freightMatches.length} 家門市可送達)`);

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

console.log("🎉 所有真實試算表資料檢索測試 100% 全部通過！");
