// update_index_with_real_data.js
const fs = require('fs');

const storeData = JSON.parse(fs.readFileSync('store_data.json', 'utf8'));
let indexHtml = fs.readFileSync('index.html', 'utf8');

const engineHeader = "// STORE DIRECTORY & FREIGHT ENGINE (門市聯絡與跨店運費引擎)";
const endMarker = "window.refreshStoreDirectoryData = refreshStoreDirectoryData;";

const startIdx = indexHtml.indexOf(engineHeader);
const endIdx = indexHtml.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find markers in index.html");
    process.exit(1);
}

const realStartIdx = indexHtml.lastIndexOf("// ===", startIdx);
const realEndIdx = endIdx + endMarker.length;

const storeDataStr = JSON.stringify(storeData);

const newEngineCode = `// =============================================
        // STORE DIRECTORY & FREIGHT ENGINE (門市聯絡與跨店運費引擎)
        // =============================================
        const STORE_DIRECTORY_STORAGE_KEY = 'time8_store_directory_data';
        const GOOGLE_SPREADSHEET_ID = '1bIGh4kVpYvP1PlI_HvLYWOTZAgaKOBJKzobfbl0Bab4';

        // 內嵌全台門市、家電MD與跨店運費真實資料庫 (共 ${storeData.contacts.length} 筆聯絡、${Object.keys(storeData.stores).length} 家門市跨區運費)
        const DEFAULT_STORE_DIRECTORY_DATA = ${storeDataStr};

        let _storeDirectoryState = {
            dataStore: null,
            activeTab: 'all',
            searchQuery: '',
            isLoading: false,
            expandedStoreCodes: new Set()
        };

        function parseSafeFreightFee(feeVal) {
            if (feeVal === null || feeVal === undefined) return { raw: '0', amount: 0, isFree: true };
            const str = String(feeVal).trim();
            if (str === '0' || str === '$0' || str === '免運' || str === '免費' || str === '0元') {
                return { raw: '$0 免運', amount: 0, isFree: true };
            }
            const match = str.match(/[0-9,]+/);
            const num = match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
            return { raw: '$' + num.toLocaleString(), amount: num, isFree: num === 0 };
        }

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

        function initStoreDirectoryEngine() {
            try {
                const cached = JSON.parse(localStorage.getItem(STORE_DIRECTORY_STORAGE_KEY) || 'null');
                if (cached && (cached.contacts || cached.stores)) {
                    _storeDirectoryState.dataStore = cached;
                } else {
                    _storeDirectoryState.dataStore = DEFAULT_STORE_DIRECTORY_DATA;
                }
            } catch (e) {
                _storeDirectoryState.dataStore = DEFAULT_STORE_DIRECTORY_DATA;
            }
        }

        function setStoreDirectoryTab(tab) {
            _storeDirectoryState.activeTab = tab;
            ['All', 'Stores', 'Freight', 'MD'].forEach(t => {
                const btn = document.getElementById('storeTab' + t);
                if (btn) btn.classList.toggle('active', t.toLowerCase() === tab);
            });
            if ('vibrate' in navigator) navigator.vibrate(8);
            renderStoreDirectoryUI();
        }

        function onStoreSearchInput(e) {
            const val = e.target.value || '';
            _storeDirectoryState.searchQuery = val;
            const clearBtn = document.getElementById('storeSearchClearBtn');
            if (clearBtn) clearBtn.classList.toggle('hidden', val.length === 0);
            renderStoreDirectoryUI();
        }

        function clearStoreSearch() {
            const input = document.getElementById('storeSearchInput');
            if (input) input.value = '';
            _storeDirectoryState.searchQuery = '';
            const clearBtn = document.getElementById('storeSearchClearBtn');
            if (clearBtn) clearBtn.classList.add('hidden');
            renderStoreDirectoryUI();
        }

        function toggleStoreFeeAccordion(storeCode) {
            if (_storeDirectoryState.expandedStoreCodes.has(storeCode)) {
                _storeDirectoryState.expandedStoreCodes.delete(storeCode);
            } else {
                _storeDirectoryState.expandedStoreCodes.add(storeCode);
            }
            if ('vibrate' in navigator) navigator.vibrate(6);
            renderStoreDirectoryUI();
        }

        async function fetchGVizSheet(sheetName) {
            const url = 'https://docs.google.com/spreadsheets/d/' + GOOGLE_SPREADSHEET_ID + '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(sheetName);
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error('Fetch failed: ' + res.status);
            const text = await res.text();
            const match = text.match(/google\\.visualization\\.Query\\.setResponse\\(([\\s\\S]*)\\);/);
            if (!match) throw new Error('Invalid GViz format');
            return JSON.parse(match[1]);
        }

        async function refreshStoreDirectoryData(e) {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            if (_storeDirectoryState.isLoading) return;
            _storeDirectoryState.isLoading = true;

            const icon = document.getElementById('storeRefreshIcon');
            const statusEl = document.getElementById('storeStatusBadge');
            if (icon) icon.classList.add('fa-spin');
            if (statusEl) statusEl.textContent = '正在同步試算表...';

            if ('vibrate' in navigator) navigator.vibrate(12);

            try {
                const freshData = {
                    contacts: [],
                    stores: _storeDirectoryState.dataStore.stores || DEFAULT_STORE_DIRECTORY_DATA.stores,
                    lastSyncTime: Date.now()
                };

                // 1. 同步 📋全省聯絡
                const contactSheet = await fetchGVizSheet('📋全省聯絡');
                if (contactSheet && contactSheet.table && contactSheet.table.rows) {
                    const rows = contactSheet.table.rows;
                    for (let i = 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || !r.c) continue;
                        const getVal = (idx) => r.c[idx] ? (r.c[idx].f || r.c[idx].v || '').toString().trim() : '';
                        const storeName = getVal(0);
                        if (!storeName) continue;
                        const codeMatch = storeName.match(/^[A-Za-z]{2,3}/);
                        const storeCode = getVal(1) || (codeMatch ? codeMatch[0].toUpperCase() : '');

                        freshData.contacts.push({
                            '店名': storeName,
                            '代碼': storeCode,
                            '店長': getVal(2),
                            '處長': getVal(3),
                            '課長': getVal(4),
                            '課長電話': getVal(5),
                            '助理': getVal(6),
                            '助理電話': getVal(7),
                            '地址': getVal(8),
                            '電話': getVal(9),
                            'category': '📋全省聯絡'
                        });
                    }
                }

                // 2. 同步 🤖家電MD
                const mdSheet = await fetchGVizSheet('🤖家電MD');
                if (mdSheet && mdSheet.table && mdSheet.table.rows) {
                    const rows = mdSheet.table.rows;
                    for (let i = 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || !r.c) continue;
                        const getVal = (idx) => r.c[idx] ? (r.c[idx].f || r.c[idx].v || '').toString().trim() : '';
                        const dept = getVal(0);
                        const name = getVal(1);
                        if (!dept && !name) continue;
                        const extMatch = name.match(/#(\\d+)/);
                        freshData.contacts.push({
                            '部門': dept,
                            '負責人': name,
                            '電話': getVal(2),
                            '分機': extMatch ? '#' + extMatch[1] : '',
                            'LINE': getVal(3),
                            'category': '🤖家電MD'
                        });
                    }
                }

                if (freshData.contacts.length > 0) {
                    _storeDirectoryState.dataStore = freshData;
                    localStorage.setItem(STORE_DIRECTORY_STORAGE_KEY, JSON.stringify(freshData));
                    showZenCapsuleNotification({
                        emoji: '✦',
                        title: '試算表同步完成',
                        message: '已更新 ' + freshData.contacts.length + ' 筆門市與 MD 名錄',
                        duration: 2500
                    });
                }
            } catch (err) {
                console.log('Store sync notice:', err);
                showZenCapsuleNotification({
                    emoji: '✦',
                    title: '離線資料庫可用',
                    message: '已為您保留 100% 完整門市與運費快取',
                    duration: 2500
                });
            } finally {
                _storeDirectoryState.isLoading = false;
                if (icon) icon.classList.remove('fa-spin');
                renderStoreDirectoryUI();
            }
        }

        function renderStoreDirectoryUI() {
            const container = document.getElementById('storeResultsZone');
            const statusBadge = document.getElementById('storeStatusBadge');
            const countBadge = document.getElementById('storeCountBadge');
            if (!container) return;

            if (!_storeDirectoryState.dataStore) {
                initStoreDirectoryEngine();
            }

            const ds = _storeDirectoryState.dataStore || DEFAULT_STORE_DIRECTORY_DATA;
            const q = String(_storeDirectoryState.searchQuery || '').toLowerCase().trim();
            const tab = _storeDirectoryState.activeTab || 'all';

            const contacts = ds.contacts || [];
            const storesMap = ds.stores || {};

            let totalStoreCount = 0;

            const matchedStores = [];
            const matchedMDs = [];
            const matchedFreightStores = [];

            contacts.forEach(c => {
                const isMD = c.category && c.category.includes('MD');
                const name = String(c['店名'] || c['部門'] || '').trim();
                const code = String(c['代碼'] || '').trim();
                const phone = String(c['電話'] || c['課長電話'] || c['助理電話'] || '').trim();
                const address = String(c['地址'] || '').trim();
                const allStaffStr = [c['店長'], c['處長'], c['課長'], c['助理'], c['負責人'], c['部門']].filter(Boolean).join(' ');

                const isMatch = !q || name.toLowerCase().includes(q) || code.toLowerCase().includes(q) ||
                                phone.toLowerCase().includes(q) || allStaffStr.toLowerCase().includes(q) || address.toLowerCase().includes(q);

                if (isMD) {
                    if (tab === 'all' || tab === 'md') {
                        if (isMatch) matchedMDs.push(c);
                    }
                } else {
                    totalStoreCount++;
                    if (tab === 'all' || tab === 'stores') {
                        if (isMatch) matchedStores.push(c);
                    }
                }
            });

            if (tab === 'all' || tab === 'freight') {
                Object.keys(storesMap).forEach(codeKey => {
                    const storeObj = storesMap[codeKey];
                    const storeCode = String(storeObj.code || codeKey).trim();
                    const storeName = String(storeObj.name || codeKey).trim();
                    const isStoreMatch = q && (storeCode.toLowerCase().includes(q) || storeName.toLowerCase().includes(q));

                    const filteredFees = (storeObj.fees || []).filter(f => {
                        if (!q) return true;
                        if (isStoreMatch) return true;
                        const area = String(f.area || '').toLowerCase();
                        const feeStr = String(f.fee || '').toLowerCase();
                        return area.includes(q) || feeStr.includes(q);
                    });

                    if (filteredFees.length > 0) {
                        matchedFreightStores.push({
                            code: storeCode,
                            name: storeName,
                            fees: filteredFees
                        });
                    }
                });
            }

            if (statusBadge) {
                const dotColor = 'var(--green)';
                statusBadge.innerHTML = '<span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:6px; height:6px; border-radius:50%; background:' + dotColor + ';"></span><span>' + (ds.lastSyncTime ? '已同步 (' + new Date(ds.lastSyncTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + ')' : '資料庫已就緒') + '</span></span>';
            }
            if (countBadge) {
                const totalResultCount = matchedStores.length + matchedMDs.length + (tab === 'freight' ? matchedFreightStores.length : 0);
                countBadge.textContent = q ? '搜尋到 ' + totalResultCount + ' 筆' : totalStoreCount + ' 間門市 · ' + Object.keys(storesMap).length + ' 家運費表';
            }

            let html = '';

            if (matchedStores.length === 0 && matchedMDs.length === 0 && matchedFreightStores.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:36px 16px; color:var(--label-tertiary);"><div style="font-size:24px; margin-bottom:6px; opacity:0.6;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div><div style="font-size:13.5px; font-weight:600; color:var(--label);">查無符合的資料</div><div style="font-size:11.5px; margin-top:3px; color:var(--label-tertiary);">可嘗試輸入店名、店碼 (022) 或行政區</div></div>';
                return;
            }

            // 1. 門市聯絡卡片
            if (matchedStores.length > 0 && (tab === 'all' || tab === 'stores')) {
                html += '<div style="font-size:11px; font-weight:600; color:var(--label-tertiary); letter-spacing:0.04em; margin:6px 2px 8px;">門市電話名錄 (' + matchedStores.length + ')</div>';
                matchedStores.forEach(s => {
                    const name = s['店名'] || '門市';
                    const code = s['代碼'] || '';
                    const storeManager = s['店長'] || '';
                    const director = s['處長'] || '';
                    const sectionChief = s['課長'] || '';
                    const sectionPhone = s['課長電話'] || '';
                    const assistant = s['助理'] || '';
                    const assistantPhone = s['助理電話'] || '';
                    const address = s['地址'] || '';
                    const phone = s['電話'] || '';

                    const cleanPhone = phone.replace(/[^0-9+]/g, '');
                    const cleanSecPhone = sectionPhone.replace(/[^0-9+]/g, '');
                    const cleanAstPhone = assistantPhone.replace(/[^0-9+]/g, '');

                    const codeMatch = name.match(/^[A-Za-z]{2,3}/);
                    const lookupKey = (codeMatch ? codeMatch[0] : (code || name)).toUpperCase();
                    const freightData = storesMap[lookupKey] || storesMap[name] || null;
                    const feeCount = freightData && freightData.fees ? freightData.fees.length : 0;
                    const isExpanded = _storeDirectoryState.expandedStoreCodes.has(lookupKey);

                    html += '<div class="store-card">';
                    html += '<div class="store-card-header">';
                    html += '<div style="display:flex; align-items:center; gap:6px;">';
                    html += '<span style="font-size:14.5px; font-weight:700; color:var(--label); letter-spacing:-0.01em;">' + escapeHtml(name) + '</span>';
                    if (code) html += '<span class="store-badge-code">代碼 ' + escapeHtml(code) + '</span>';
                    html += '</div>';
                    if (phone) {
                        html += '<a href="tel:' + cleanPhone + '" class="store-btn-call active-scale" title="撥打電話">';
                        html += '<svg viewBox="0 0 24 24" width="10.5" height="10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
                        html += '<span>' + escapeHtml(phone.split('\\n')[0]) + '</span>';
                        html += '</a>';
                    }
                    html += '</div>';

                    html += '<div style="padding:9px 13px; font-size:12px; color:var(--label-secondary); line-height:1.55;">';
                    if (storeManager && storeManager.trim()) {
                        const parsedMgr = parseStaffContact(storeManager);
                        html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:3px; flex-wrap:wrap; gap:4px;">';
                        html += '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">';
                        html += '<span style="color:var(--label-tertiary); width:36px; flex-shrink:0;">店長</span>';
                        html += '<span style="font-weight:600; color:var(--label);">' + escapeHtml(parsedMgr.name) + '</span>';
                        if (parsedMgr.email) {
                            html += '<a href="mailto:' + escapeHtml(parsedMgr.email) + '" class="store-email-link active-scale" title="寄信給店長">';
                            html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>';
                            html += '<span>' + escapeHtml(parsedMgr.email) + '</span>';
                            html += '</a>';
                        }
                        if (parsedMgr.note) {
                            html += '<span style="font-size:10.5px; color:var(--label-tertiary);">' + escapeHtml(parsedMgr.note) + '</span>';
                        }
                        html += '</div>';
                        html += '</div>';
                    }
                    if (director && director.trim()) {
                        const parsedDir = parseStaffContact(director);
                        html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:3px; flex-wrap:wrap; gap:4px;">';
                        html += '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">';
                        html += '<span style="color:var(--label-tertiary); width:36px; flex-shrink:0;">處長</span>';
                        if (parsedDir.name) {
                            html += '<span style="color:var(--label); font-weight:500;">' + escapeHtml(parsedDir.name) + '</span>';
                        }
                        if (parsedDir.email) {
                            html += '<a href="mailto:' + escapeHtml(parsedDir.email) + '" class="store-email-link active-scale" title="寄信給處長">';
                            html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>';
                            html += '<span>' + escapeHtml(parsedDir.email) + '</span>';
                            html += '</a>';
                        }
                        if (parsedDir.note) {
                            html += '<span style="font-size:10.5px; color:var(--label-tertiary);">' + escapeHtml(parsedDir.note) + '</span>';
                        }
                        html += '</div>';
                        html += '</div>';
                    }
                    if (sectionChief && sectionChief.trim()) {
                        const parsedSec = parseStaffContact(sectionChief);
                        html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:3px; flex-wrap:wrap; gap:4px;">';
                        html += '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">';
                        html += '<span style="color:var(--label-tertiary); width:36px; flex-shrink:0;">課長</span>';
                        if (parsedSec.name) {
                            html += '<span style="color:var(--label); font-weight:500;">' + escapeHtml(parsedSec.name) + '</span>';
                        }
                        if (parsedSec.email) {
                            html += '<a href="mailto:' + escapeHtml(parsedSec.email) + '" class="store-email-link active-scale" title="寄信給課長">';
                            html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>';
                            html += '<span>' + escapeHtml(parsedSec.email) + '</span>';
                            html += '</a>';
                        }
                        if (parsedSec.note) {
                            html += '<span style="font-size:10.5px; color:var(--label-tertiary);">' + escapeHtml(parsedSec.note) + '</span>';
                        }
                        html += '</div>';
                        if (sectionPhone) {
                            html += '<a href="tel:' + cleanSecPhone + '" style="font-size:11px; font-weight:600; color:var(--blue); text-decoration:none; display:inline-flex; align-items:center; gap:3px; margin-left:auto;"><span>' + escapeHtml(sectionPhone) + '</span></a>';
                        }
                        html += '</div>';
                    }
                    if (assistant && assistant.trim()) {
                        const parsedAst = parseStaffContact(assistant);
                        html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:3px; flex-wrap:wrap; gap:4px;">';
                        html += '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">';
                        html += '<span style="color:var(--label-tertiary); width:36px; flex-shrink:0;">助理</span>';
                        if (parsedAst.name) {
                            html += '<span style="color:var(--label); font-weight:500;">' + escapeHtml(parsedAst.name) + '</span>';
                        }
                        if (parsedAst.email) {
                            html += '<a href="mailto:' + escapeHtml(parsedAst.email) + '" class="store-email-link active-scale" title="寄信給助理">';
                            html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>';
                            html += '<span>' + escapeHtml(parsedAst.email) + '</span>';
                            html += '</a>';
                        }
                        if (parsedAst.note) {
                            html += '<span style="font-size:10.5px; color:var(--label-tertiary);">' + escapeHtml(parsedAst.note) + '</span>';
                        }
                        html += '</div>';
                        if (assistantPhone) {
                            html += '<a href="tel:' + cleanAstPhone + '" style="font-size:11px; font-weight:600; color:var(--blue); text-decoration:none; display:inline-flex; align-items:center; gap:3px; margin-left:auto;"><span>' + escapeHtml(assistantPhone) + '</span></a>';
                        }
                        html += '</div>';
                    }
                    if (address) {
                        html += '<div style="display:flex; gap:6px; margin-top:3px; padding-top:3px; border-top:0.5px solid var(--separator);"><span style="color:var(--label-tertiary); width:36px;">地址</span><a href="https://maps.apple.com/?q=' + encodeURIComponent(address) + '" target="_blank" style="color:var(--label-secondary); text-decoration:none; display:inline-flex; align-items:center; gap:3px;"><span>' + escapeHtml(address) + '</span></a></div>';
                    }
                    html += '</div>';

                    if (feeCount > 0) {
                        html += '<div style="padding:7px 13px; border-top:0.5px solid var(--separator); background:var(--fill-tertiary); display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleStoreFeeAccordion(\\'' + escapeHtml(lookupKey) + '\\')">';
                        html += '<span style="font-size:11.5px; font-weight:600; color:var(--blue); display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> 跨店外送運費（收錄 ' + feeCount + ' 區）</span>';
                        html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--label-tertiary); transform:' + (isExpanded ? 'rotate(180deg)' : 'none') + '; transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>';
                        html += '</div>';

                        if (isExpanded) {
                            html += '<div style="border-top:0.5px solid var(--separator); background:var(--fill-tertiary);">';
                            freightData.fees.forEach(f => {
                                const feeObj = parseSafeFreightFee(f.fee);
                                html += '<div class="store-fee-row">';
                                html += '<span style="font-size:11.5px; font-weight:500;">' + escapeHtml(f.area) + '</span>';
                                html += '<span class="store-fee-pill ' + (feeObj.isFree ? 'free' : 'paid') + '">' + feeObj.raw + '</span>';
                                html += '</div>';
                            });
                            html += '</div>';
                        }
                    }

                    html += '</div>';
                });
            }

            // 2. 跨店運費獨立搜尋卡片 (Freight Tab)
            if (matchedFreightStores.length > 0 && tab === 'freight') {
                html += '<div style="font-size:11px; font-weight:600; color:var(--label-tertiary); letter-spacing:0.04em; margin:6px 2px 8px;">跨區外送運費標準 (' + matchedFreightStores.length + ')</div>';
                matchedFreightStores.forEach(fs => {
                    html += '<div class="store-card">';
                    html += '<div class="store-card-header">';
                    html += '<div style="display:flex; align-items:center; gap:6px;">';
                    html += '<span style="font-size:14.5px; font-weight:700; color:var(--label);">' + escapeHtml(fs.name) + '</span>';
                    html += '<span class="store-badge-code">' + escapeHtml(fs.code) + '</span>';
                    html += '</div>';
                    html += '<span style="font-size:11px; color:var(--label-tertiary);">收錄 ' + fs.fees.length + ' 區域</span>';
                    html += '</div>';
                    html += '<div>';
                    fs.fees.forEach(f => {
                        const feeObj = parseSafeFreightFee(f.fee);
                        html += '<div class="store-fee-row">';
                        html += '<span style="font-size:11.5px; font-weight:500;">' + escapeHtml(f.area) + '</span>';
                        html += '<span class="store-fee-pill ' + (feeObj.isFree ? 'free' : 'paid') + '">' + feeObj.raw + '</span>';
                        html += '</div>';
                    });
                    html += '</div>';
                    html += '</div>';
                });
            }

            // 3. 家電 MD 聯絡卡片
            if (matchedMDs.length > 0 && (tab === 'all' || tab === 'md')) {
                html += '<div style="font-size:11px; font-weight:600; color:var(--label-tertiary); letter-spacing:0.04em; margin:10px 2px 8px;">家電 MD 專業名錄 (' + matchedMDs.length + ')</div>';
                matchedMDs.forEach(m => {
                    const dept = m['部門'] || '家電 MD';
                    const staff = m['負責人'] || '';
                    const ext = m['分機'] || '';
                    const phone = m['電話'] || '';
                    const lineId = m['LINE'] || '';
                    const cleanPhone = phone.replace(/[^0-9+]/g, '');

                    const cleanStaff = staff.replace(/[🌈🐼🦉🐣🐒🐸🧙‍♂️]/g, '').trim();

                    html += '<div class="store-card">';
                    html += '<div class="store-card-header">';
                    html += '<div>';
                    html += '<span style="font-size:14px; font-weight:700; color:var(--label);">' + escapeHtml(dept.replace(/\\n/g, ' ')) + '</span>';
                    if (cleanStaff) html += '<div style="font-size:12.5px; color:var(--label-secondary); font-weight:600; margin-top:2px;">' + escapeHtml(cleanStaff) + '</div>';
                    html += '</div>';
                    if (phone) {
                        html += '<a href="tel:' + cleanPhone + '" class="store-btn-call active-scale" title="撥打電話">';
                        html += '<svg viewBox="0 0 24 24" width="10.5" height="10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
                        html += '<span>' + escapeHtml(phone) + '</span>';
                        html += '</a>';
                    }
                    html += '</div>';
                    html += '<div style="padding:9px 13px; font-size:12px; color:var(--label-secondary); display:flex; justify-content:space-between; align-items:center;">';
                    html += '<div>';
                    if (ext) html += '<span style="margin-right:10px;">分機 <strong style="color:var(--label); font-family:ui-monospace, monospace; font-size:12px;">' + escapeHtml(ext) + '</strong></span>';
                    if (lineId) html += '<span>LINE: <strong style="color:var(--label);">' + escapeHtml(lineId) + '</strong></span>';
                    html += '</div>';
                    html += '<span style="font-size:10.5px; color:var(--label-tertiary);">採購營運</span>';
                    html += '</div>';
                    html += '</div>';
                });
            }

            container.innerHTML = html;
        }

        window.setStoreDirectoryTab = setStoreDirectoryTab;
        window.onStoreSearchInput = onStoreSearchInput;
        window.clearStoreSearch = clearStoreSearch;
        window.toggleStoreFeeAccordion = toggleStoreFeeAccordion;
        window.refreshStoreDirectoryData = refreshStoreDirectoryData;
        window.renderStoreDirectoryUI = renderStoreDirectoryUI;`;

const updatedHtml = indexHtml.substring(0, realStartIdx) + newEngineCode + indexHtml.substring(realEndIdx);
fs.writeFileSync('index.html', updatedHtml);
console.log("🎉 index.html 成功加入各店處長欄位！");
