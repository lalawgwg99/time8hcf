// test-store-directory.js
const assert = require('assert');

// 模擬安全運費數字提取器
function parseFreightAmount(feeStr) {
    if (feeStr === null || feeStr === undefined) return 0;
    const str = String(feeStr).trim();
    if (str === '免運' || str === '0' || str === '$0' || str === '免費') return 0;
    const match = str.match(/[0-9]+/);
    return match ? parseInt(match[0], 10) : 0;
}

// 模擬多維度搜尋過濾器
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
        const name = String(c['店名'] || c['部門'] || c['名稱'] || '').toLowerCase();
        const code = String(c['代碼'] || c['店別代碼'] || c['店號'] || '').toLowerCase();
        const phone = String(c['電話'] || c['分機'] || c['連絡電話'] || '').toLowerCase();
        const staff = String(c['負責人'] || c['主管'] || c['聯絡人'] || '').toLowerCase();
        const address = String(c['地址'] || '').toLowerCase();

        const match = !q || name.includes(q) || code.includes(q) || phone.includes(q) || staff.includes(q) || address.includes(q);

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
                if (isStoreMatch) return true; // 若匹配到該店，則列出該店所有區域
                return area.includes(q) || feeText.includes(q); // 或匹配目的地區域
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

// 執行測試
console.log("=== 開始執行門市與跨店運費引擎單元測試 ===");

// Test 1: 運費數字解析容錯測試
assert.strictEqual(parseFreightAmount('$0'), 0);
assert.strictEqual(parseFreightAmount('免運'), 0);
assert.strictEqual(parseFreightAmount('200元'), 200);
assert.strictEqual(parseFreightAmount('$450'), 450);
assert.strictEqual(parseFreightAmount(null), 0);
assert.strictEqual(parseFreightAmount(undefined), 0);
assert.strictEqual(parseFreightAmount(''), 0);
console.log("✅ Test 1: 運費數字解析與空值防護通過");

// Test 2: 模擬資料搜尋測試
const mockDataStore = {
    contacts: [
        { '店名': '五甲門市', '代碼': 'WG', '電話': '07-7654321', '負責人': '林經理', '地址': '高雄市鳳山區五甲二路100號', category: '📋全省聯絡' },
        { '店名': '內湖門市', '代碼': 'NZ', '電話': '02-8765432', '負責人': '陳副理', '地址': '台北市內湖區成功路二段20號', category: '📋全省聯絡' },
        { '部門': '40MD', '負責人': '張專員', '分機': '#8801', '電話': '0912-345678', category: '🤖家電MD' }
    ],
    stores: {
        'WG': {
            code: 'WG',
            name: '五甲門市',
            fees: [
                { area: '鳳山區', fee: '0' },
                { area: '前鎮區', fee: '0' },
                { area: '小港區', fee: '200' },
                { area: '大寮區', fee: '200' },
                { area: '林園區', fee: '400' }
            ]
        },
        'NZ': {
            code: 'NZ',
            name: '內湖門市',
            fees: [
                { area: '內湖區', fee: '0' },
                { area: '南港區', fee: '200' },
                { area: '汐止區', fee: '300' }
            ]
        }
    }
};

// 搜尋店號 WG
const resWG = searchDirectory(mockDataStore, 'WG', 'all');
assert.strictEqual(resWG.stores.length, 1);
assert.strictEqual(resWG.stores[0]['店名'], '五甲門市');
assert.strictEqual(resWG.freightMatches.length, 1);
assert.strictEqual(resWG.freightMatches[0].fees.length, 5);
console.log("✅ Test 2: 店號代碼查詢 (WG) 通過");

// 搜尋目的地區域 鳳山
const resFengshan = searchDirectory(mockDataStore, '鳳山', 'all');
assert.strictEqual(resFengshan.freightMatches.length, 1);
assert.strictEqual(resFengshan.freightMatches[0].fees[0].area, '鳳山區');
console.log("✅ Test 3: 目的地區域反查 (鳳山) 通過");

// 搜尋家電 MD
const resMD = searchDirectory(mockDataStore, '40MD', 'all');
assert.strictEqual(resMD.mdList.length, 1);
assert.strictEqual(resMD.mdList[0]['部門'], '40MD');
console.log("✅ Test 4: 家電 MD 部門查詢 通過");

// Tab 切換過濾測試
const resTabStores = searchDirectory(mockDataStore, '', 'stores');
assert.strictEqual(resTabStores.stores.length, 2);
assert.strictEqual(resTabStores.mdList.length, 0);
assert.strictEqual(resTabStores.freightMatches.length, 0);
console.log("✅ Test 5: Tab 欄位分流過濾 通過");

console.log("🎉 所有門市與跨店運費測試全部通過！");
