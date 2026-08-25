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

        // =============================================
        // SMART STORE DISPATCH & RECOMMENDER ENGINE (智慧跨店選店引擎)
        // =============================================
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
            
            // 1. Check leading 3-digit postal code (e.g. '802 高雄市苓雅區...')
            const zipMatch = text.match(/^(\d{3})/);
            if (zipMatch && TAIWAN_GEO_ZIP_MAP[zipMatch[1]]) {
                return TAIWAN_GEO_ZIP_MAP[zipMatch[1]];
            }

            // 2. Match by exact district or clean district name
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

        function getSmartStoreRecommendations(addressStr) {
            if (!_storeDirectoryState.dataStore) initStoreDirectoryEngine();
            const ds = _storeDirectoryState.dataStore || DEFAULT_STORE_DIRECTORY_DATA;
            const parsed = parseDestinationAddress(addressStr);
            if (!parsed.cleanDist && !parsed.city && !parsed.raw) return { parsed, topStore: null, alternatives: [] };

            const storesMap = ds.stores || {};
            const contacts = ds.contacts || [];

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
                        sortScore = 100; // Local store first
                    } else if (distKm !== null && distKm < 8) {
                        sortScore = 200 + distKm; // Very close neighboring store
                    } else if (feeAmount !== Infinity) {
                        sortScore = 300 + feeAmount; // Supported delivery fee
                    } else if (distKm !== null) {
                        sortScore = 400 + distKm; // Distance in km
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

        function openSmartStoreModal(prefillAddr) {
            if ('vibrate' in navigator) navigator.vibrate(10);
            playSingleClickSound("G4");

            const modal = document.getElementById('smartStoreModal');
            if (modal) {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';

                const input = document.getElementById('smartAddressInput');
                if (input) {
                    if (prefillAddr) input.value = prefillAddr;
                    renderSmartStoreResults(input.value || '');
                    setTimeout(() => input.focus(), 150);
                }
            }
        }

        function closeSmartStoreModal() {
            const modal = document.getElementById('smartStoreModal');
            if (modal) {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }

        function onSmartAddressInput(e) {
            const val = e.target.value || '';
            const clearBtn = document.getElementById('smartAddressClearBtn');
            if (clearBtn) clearBtn.classList.toggle('hidden', val.length === 0);
            renderSmartStoreResults(val);
        }

        function clearSmartAddressInput() {
            const input = document.getElementById('smartAddressInput');
            if (input) input.value = '';
            const clearBtn = document.getElementById('smartAddressClearBtn');
            if (clearBtn) clearBtn.classList.add('hidden');
            renderSmartStoreResults('');
        }

        function setSmartQuickArea(areaStr) {
            if ('vibrate' in navigator) navigator.vibrate(8);
            const input = document.getElementById('smartAddressInput');
            if (input) {
                input.value = areaStr;
                const clearBtn = document.getElementById('smartAddressClearBtn');
                if (clearBtn) clearBtn.classList.remove('hidden');
                renderSmartStoreResults(areaStr);
            }
        }

        function copySmartDispatchNote(storeName, storeCode, feeText, phone, address, destAddr) {
            if ('vibrate' in navigator) navigator.vibrate(12);
            playSingleClickSound("C5");

            const note = `【跨店出貨派工建議單】\n客戶送達地址：${destAddr || '指定目的地'}\n推薦出貨門市：${storeName} (代碼 ${storeCode})\n運費標準：${feeText}\n門市電話：${phone}\n門市地址：${address}\n(由 TIME 8 智慧選店系統產出)`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(note).then(() => {
                    showZenCapsuleNotification({
                        title: '派工單已複製',
                        message: `已複製 ${storeName} 出貨派工備忘錄`,
                        emoji: '📋'
                    });
                });
            } else {
                showZenCapsuleNotification({
                    title: '派工資訊已產出',
                    message: `${storeName} · 運費 ${feeText}`,
                    emoji: '🚚'
                });
            }
        }

        function renderSmartStoreResults(addressStr) {
            const container = document.getElementById('smartResultsZone');
            if (!container) return;

            if (!addressStr || !addressStr.trim()) {
                container.innerHTML = '<div style="text-align:center; padding:28px 16px; color:var(--label-tertiary);"><div style="font-size:24px; margin-bottom:6px; opacity:0.6;"><i class="fas fa-map-location-dot"></i></div><div style="font-size:13px; font-weight:600; color:var(--label);">請輸入送達地址或點選熱門區域</div><div style="font-size:11px; margin-top:3px; color:var(--label-tertiary);">系統將自動比對全台 83 間門市與 59 家跨區外送運費矩陣</div></div>';
                return;
            }

            const analysis = getSmartStoreRecommendations(addressStr);
            const { parsed, topStore, alternatives } = analysis;

            if (!topStore) {
                container.innerHTML = '<div style="text-align:center; padding:28px 16px; color:var(--label-tertiary);"><div style="font-size:24px; margin-bottom:6px; opacity:0.6;"><i class="fas fa-circle-question"></i></div><div style="font-size:13px; font-weight:600; color:var(--label);">暫查無匹配的跨店配送規則</div><div style="font-size:11px; margin-top:3px; color:var(--label-tertiary);">可嘗試輸入完整縣市與行政區（如：高雄市楠梓區）</div></div>';
                return;
            }

            const topC = topStore.contact;
            const topName = topC['店名'] || '門市';
            const topCode = topC['代碼'] || '';
            const topPhone = topC['電話'] || '';
            const cleanTopPhone = topPhone.replace(/[^0-9+]/g, '');
            const topAddress = topC['地址'] || '';
            const topManager = topC['店長'] || '';
            const topChief = topC['課長'] || '';
            const topDirector = topC['處長'] || '';

            const parsedChief = parseStaffContact(topChief);
            const parsedDir = parseStaffContact(topDirector);
            const parsedMgr = parseStaffContact(topManager);

            let html = '';

            // Top Recommendation Card
            html += '<div style="font-size:11px; font-weight:600; color:var(--label-tertiary); letter-spacing:0.04em; margin-bottom:6px;">👑 最優出貨門市推薦</div>';
            html += '<div class="store-card" style="border:1.5px solid rgba(30,58,138,0.25); background:var(--card); box-shadow:0 4px 16px rgba(0,0,0,0.05); margin-bottom:14px;">';
            html += '<div class="store-card-header" style="background:rgba(30,58,138,0.03);">';
            html += '<div>';
            html += '<div style="display:flex; align-items:center; gap:6px;">';
            html += '<span style="font-size:15.5px; font-weight:700; color:var(--label);">' + escapeHtml(topName) + '</span>';
            if (topCode) html += '<span class="store-badge-code">代碼 ' + escapeHtml(topCode) + '</span>';
            if (topStore.isLocalStore) html += '<span style="font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; background:rgba(77,122,82,0.12); color:var(--green);">同區直出</span>';
            html += '</div>';
            if (parsed.cleanDist) html += '<div style="font-size:11px; color:var(--label-tertiary); margin-top:2px;">送達目的地：' + escapeHtml(parsed.city + parsed.district) + '</div>';
            html += '</div>';
            html += '<div style="text-align:right;">';
            html += '<div style="font-size:15px; font-weight:700; color:var(--green);">' + escapeHtml(topStore.feeRaw) + '</div>';
            html += '<div style="font-size:10px; color:var(--label-tertiary);">' + (topStore.isLocalStore ? '同行政區免跨店費' : '跨店運費標準') + '</div>';
            html += '</div>';
            html += '</div>';

            html += '<div style="padding:10px 14px; font-size:12px; color:var(--label-secondary); line-height:1.6;">';
            if (parsedMgr.name) html += '<div style="display:flex; gap:6px; margin-bottom:2px;"><span style="color:var(--label-tertiary); width:36px;">店長</span><span style="font-weight:600; color:var(--label);">' + escapeHtml(parsedMgr.name) + '</span></div>';
            if (parsedChief.name) {
                html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:2px; flex-wrap:wrap;">';
                html += '<span style="color:var(--label-tertiary); width:36px;">課長</span><span style="color:var(--label); font-weight:500;">' + escapeHtml(parsedChief.name) + '</span>';
                if (parsedChief.email) html += '<a href="mailto:' + escapeHtml(parsedChief.email) + '" class="store-email-link active-scale"><span>' + escapeHtml(parsedChief.email) + '</span></a>';
                html += '</div>';
            }
            if (topAddress) html += '<div style="display:flex; gap:6px; margin-top:3px; padding-top:3px; border-top:0.5px solid var(--separator);"><span style="color:var(--label-tertiary); width:36px;">地址</span><span style="color:var(--label-secondary);">' + escapeHtml(topAddress) + '</span></div>';
            html += '</div>';

            // Action Toolbar
            html += '<div style="padding:8px 14px 12px; display:flex; gap:8px;">';
            if (topPhone) {
                html += '<a href="tel:' + cleanTopPhone + '" class="active-scale" style="flex:1; padding:9px; border-radius:10px; background:var(--blue); color:#fff; text-decoration:none; font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:4px;">';
                html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
                html += '<span>一鍵致電</span>';
                html += '</a>';
            }
            html += '<button type="button" onclick="copySmartDispatchNote(\'' + escapeHtml(topName) + '\', \'' + escapeHtml(topCode) + '\', \'' + escapeHtml(topStore.feeRaw) + '\', \'' + escapeHtml(topPhone.split(\'\\n\')[0]) + '\', \'' + escapeHtml(topAddress) + '\', \'' + escapeHtml(parsed.raw) + '\')" class="active-scale" style="flex:1; padding:9px; border-radius:10px; background:var(--fill-secondary); color:var(--label); border:0.5px solid var(--separator); font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">';
            html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';
            html += '<span>複製派工單</span>';
            html += '</button>';
            if (topAddress) {
                html += '<a href="https://maps.apple.com/?q=' + encodeURIComponent(topAddress) + '" target="_blank" class="active-scale" style="padding:9px 12px; border-radius:10px; background:var(--fill-secondary); color:var(--label); border:0.5px solid var(--separator); text-decoration:none; font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center;" title="在地圖中查看">';
                html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>';
                html += '</a>';
            }
            html += '</div>';
            html += '</div>';

            // Alternative Candidate Stores
            if (alternatives.length > 0) {
                html += '<div style="font-size:11px; font-weight:600; color:var(--label-tertiary); letter-spacing:0.04em; margin:14px 2px 8px;">🚚 其他可支援門市（依運費排序）</div>';
                html += '<div class="rounded-xl overflow-hidden" style="border:0.5px solid var(--separator); background:var(--card);">';
                alternatives.slice(0, 5).forEach((alt, idx) => {
                    const altC = alt.contact;
                    const altName = altC['店名'] || '門市';
                    const altPhone = altC['電話'] || '';
                    const cleanAltPhone = altPhone.replace(/[^0-9+]/g, '');

                    html += '<div style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; ' + (idx > 0 ? 'border-top:0.5px solid var(--separator);' : '') + '">';
                    html += '<div>';
                    html += '<div style="font-size:13.5px; font-weight:600; color:var(--label);">' + escapeHtml(altName) + ' <span class="store-badge-code">' + escapeHtml(altC['代碼'] || '') + '</span></div>';
                    html += '<div style="font-size:11px; color:var(--label-tertiary); margin-top:2px;">' + (alt.isLocalStore ? '同行政區在地門市' : (alt.matchedAreaText ? '外送涵蓋：' + escapeHtml(alt.matchedAreaText.split('、').slice(0, 3).join('、')) : '同縣市門市')) + '</div>';
                    html += '</div>';
                    html += '<div style="display:flex; align-items:center; gap:8px;">';
                    html += '<span class="store-fee-pill ' + (alt.feeAmount === 0 ? 'free' : 'paid') + '">' + escapeHtml(alt.feeRaw) + '</span>';
                    if (altPhone) {
                        html += '<a href="tel:' + cleanAltPhone + '" class="store-btn-call active-scale" style="padding:4px 8px; font-size:11px;">';
                        html += '<span>撥打</span>';
                        html += '</a>';
                    }
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
            }
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
            ['All', 'Stores', 'MD'].forEach(t => {
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

            contacts.forEach(c => {
                const isMD = c.category && c.category.includes('MD');
                const name = String(c['店名'] || c['部門'] || '').trim();
                const code = String(c['代碼'] || '').trim();
                const phone = String(c['電話'] || c['課長電話'] || c['助理電話'] || '').trim();
                const address = String(c['地址'] || '').trim();
                const allStaffStr = [c['店長'], c['處長'], c['課長'], c['助理'], c['負責人'], c['部門']].filter(Boolean).join(' ');

                const codeMatch = name.match(/^[A-Za-z]{2,3}/);
                const lookupKey = (codeMatch ? codeMatch[0] : (code || name)).toUpperCase();
                const freightData = storesMap[lookupKey] || storesMap[name] || null;
                const freightMatch = q && freightData && (freightData.fees || []).some(f => (String(f.area || '') + ' ' + String(f.fee || '')).toLowerCase().includes(q));

                const isMatch = !q || name.toLowerCase().includes(q) || code.toLowerCase().includes(q) ||
                                phone.toLowerCase().includes(q) || allStaffStr.toLowerCase().includes(q) || address.toLowerCase().includes(q) || freightMatch;

                if (isMD) {
                    if (tab === 'all' || tab === 'md') {
                        if (isMatch) matchedMDs.push(c);
                    }
                } else {
                    totalStoreCount++;
                    if (tab === 'all' || tab === 'stores') {
                        if (isMatch) {
                            matchedStores.push({
                                ...c,
                                _freightMatch: freightMatch
                            });
                        }
                    }
                }
            });

            if (statusBadge) {
                const dotColor = 'var(--green)';
                statusBadge.innerHTML = '<span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:6px; height:6px; border-radius:50%; background:' + dotColor + ';"></span><span>' + (ds.lastSyncTime ? '已同步 (' + new Date(ds.lastSyncTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + ')' : '資料庫已就緒') + '</span></span>';
            }
            if (countBadge) {
                const totalResultCount = matchedStores.length + matchedMDs.length;
                countBadge.textContent = q ? '搜尋到 ' + totalResultCount + ' 筆' : totalStoreCount + ' 間門市 · ' + Object.keys(storesMap).length + ' 家運費表';
            }

            let html = '';

            // Check Smart Store Dispatch Recommendation for current query
            if (q && q.length >= 2) {
                const smartAnalysis = getSmartStoreRecommendations(q);
                if (smartAnalysis && smartAnalysis.topStore && (smartAnalysis.parsed.cleanDist || smartAnalysis.parsed.city)) {
                    const topC = smartAnalysis.topStore.contact;
                    const topName = topC['店名'] || '門市';
                    const topCode = topC['代碼'] || '';
                    const topPhone = topC['電話'] || '';
                    const cleanTopPhone = topPhone.replace(/[^0-9+]/g, '');
                    
                    html += '<div style="background:rgba(30,58,138,0.05); border:1px solid rgba(30,58,138,0.2); border-radius:14px; padding:12px 14px; margin-bottom:12px;">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">';
                    html += '<span style="font-size:11px; font-weight:700; color:var(--blue); display:inline-flex; align-items:center; gap:4px;"><i class="fas fa-compass"></i> 智慧選店推薦：' + escapeHtml(topName) + (topCode ? ' (' + escapeHtml(topCode) + ')' : '') + '</span>';
                    html += '<span class="store-fee-pill ' + (smartAnalysis.topStore.isLocalStore ? 'free' : 'paid') + '">' + escapeHtml(smartAnalysis.topStore.feeRaw) + '</span>';
                    html += '</div>';
                    html += '<div style="font-size:11.5px; color:var(--label-secondary); margin-bottom:8px; line-height:1.4;">';
                    html += '目的地 ' + escapeHtml(smartAnalysis.parsed.city + smartAnalysis.parsed.district) + ' · ' + (smartAnalysis.topStore.isLocalStore ? '同行政區直出最快' : '外送支援門市');
                    html += '</div>';
                    html += '<div style="display:flex; gap:6px;">';
                    if (topPhone) {
                        html += '<a href="tel:' + cleanTopPhone + '" class="store-btn-call active-scale" style="flex:1; justify-content:center; padding:5px 8px; font-size:11px;">';
                        html += '<i class="fas fa-phone" style="font-size:9.5px;"></i> 致電門市';
                        html += '</a>';
                    }
                    html += '<button type="button" onclick="openSmartStoreModal(\'' + escapeHtml(q) + '\')" class="active-scale" style="flex:1; background:var(--card); border:0.5px solid var(--separator); border-radius:8px; font-size:11px; font-weight:600; color:var(--label); cursor:pointer; padding:5px 8px; display:flex; align-items:center; justify-content:center; gap:4px;">';
                    html += '<i class="fas fa-arrow-up-right-from-square" style="font-size:9.5px;"></i> 完整選店分析';
                    html += '</button>';
                    html += '</div>';
                    html += '</div>';
                }
            }

            if (matchedStores.length === 0 && matchedMDs.length === 0) {
                container.innerHTML = html + '<div style="text-align:center; padding:36px 16px; color:var(--label-tertiary);"><div style="font-size:24px; margin-bottom:6px; opacity:0.6;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div><div style="font-size:13.5px; font-weight:600; color:var(--label);">查無符合的資料</div><div style="font-size:11.5px; margin-top:3px; color:var(--label-tertiary);">可嘗試輸入店名、店碼 (022) 或行政區</div></div>';
                return;
            }

            // 1. 門市及跨店聯絡卡片
            if (matchedStores.length > 0 && (tab === 'all' || tab === 'stores')) {
                html += '<div style="font-size:11px; font-weight:600; color:var(--label-tertiary); letter-spacing:0.04em; margin:6px 2px 8px;">門市及跨店名錄 (' + matchedStores.length + ')</div>';
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
                    const isExpanded = _storeDirectoryState.expandedStoreCodes.has(lookupKey) || (Boolean(s._freightMatch) && Boolean(q));

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
                                const isAreaMatch = q && (String(f.area || '') + ' ' + String(f.fee || '')).toLowerCase().includes(q);
                                html += '<div class="store-fee-row" style="' + (isAreaMatch ? 'background:rgba(30,58,138,0.06); font-weight:600;' : '') + '">';
                                html += '<span style="font-size:11.5px; font-weight:500;">' + (isAreaMatch ? '✦ ' : '') + escapeHtml(f.area) + '</span>';
                                html += '<span class="store-fee-pill ' + (feeObj.isFree ? 'free' : 'paid') + '">' + feeObj.raw + '</span>';
                                html += '</div>';
                            });
                            html += '</div>';
                        }
                    }

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
