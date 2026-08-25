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
            // 台北市 (12)
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

            // 基隆市 (7)
            '200': { city: '基隆市', district: '仁愛區', cleanDist: '仁愛', lat: 25.128, lon: 121.741 },
            '201': { city: '基隆市', district: '信義區', cleanDist: '基隆信義', lat: 25.130, lon: 121.761 },
            '202': { city: '基隆市', district: '中正區', cleanDist: '基隆中正', lat: 25.150, lon: 121.768 },
            '203': { city: '基隆市', district: '中山區', cleanDist: '基隆中山', lat: 25.143, lon: 121.733 },
            '204': { city: '基隆市', district: '安樂區', cleanDist: '安樂', lat: 25.138, lon: 121.714 },
            '205': { city: '基隆市', district: '暖暖區', cleanDist: '暖暖', lat: 25.099, lon: 121.736 },
            '206': { city: '基隆市', district: '七堵區', cleanDist: '七堵', lat: 25.096, lon: 121.714 },

            // 新北市 (29)
            '207': { city: '新北市', district: '萬里區', cleanDist: '萬里', lat: 25.178, lon: 121.689 },
            '208': { city: '新北市', district: '金山區', cleanDist: '金山', lat: 25.222, lon: 121.638 },
            '220': { city: '新北市', district: '板橋區', cleanDist: '板橋', lat: 25.014, lon: 121.462 },
            '221': { city: '新北市', district: '汐止區', cleanDist: '汐止', lat: 25.063, lon: 121.658 },
            '222': { city: '新北市', district: '深坑區', cleanDist: '深坑', lat: 25.002, lon: 121.615 },
            '223': { city: '新北市', district: '石碇區', cleanDist: '石碇', lat: 24.991, lon: 121.659 },
            '224': { city: '新北市', district: '瑞芳區', cleanDist: '瑞芳', lat: 25.109, lon: 121.810 },
            '226': { city: '新北市', district: '平溪區', cleanDist: '平溪', lat: 25.025, lon: 121.738 },
            '227': { city: '新北市', district: '雙溪區', cleanDist: '雙溪', lat: 25.034, lon: 121.865 },
            '228': { city: '新北市', district: '貢寮區', cleanDist: '貢寮', lat: 25.018, lon: 121.908 },
            '231': { city: '新北市', district: '新店區', cleanDist: '新店', lat: 24.968, lon: 121.541 },
            '232': { city: '新北市', district: '坪林區', cleanDist: '坪林', lat: 24.937, lon: 121.712 },
            '233': { city: '新北市', district: '烏來區', cleanDist: '烏來', lat: 24.865, lon: 121.551 },
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

            // 宜蘭縣 (12)
            '260': { city: '宜蘭縣', district: '宜蘭市', cleanDist: '宜蘭', lat: 24.757, lon: 121.753 },
            '261': { city: '宜蘭縣', district: '頭城鎮', cleanDist: '頭城', lat: 24.859, lon: 121.823 },
            '262': { city: '宜蘭縣', district: '礁溪鄉', cleanDist: '礁溪', lat: 24.828, lon: 121.772 },
            '263': { city: '宜蘭縣', district: '壯圍鄉', cleanDist: '壯圍', lat: 24.745, lon: 121.784 },
            '264': { city: '宜蘭縣', district: '員山鄉', cleanDist: '員山', lat: 24.743, lon: 121.721 },
            '265': { city: '宜蘭縣', district: '羅東鎮', cleanDist: '羅東', lat: 24.677, lon: 121.767 },
            '266': { city: '宜蘭縣', district: '三星鄉', cleanDist: '三星', lat: 24.664, lon: 121.652 },
            '267': { city: '宜蘭縣', district: '大同鄉', cleanDist: '大同', lat: 24.676, lon: 121.606 },
            '268': { city: '宜蘭縣', district: '五結鄉', cleanDist: '五結', lat: 24.685, lon: 121.798 },
            '269': { city: '宜蘭縣', district: '冬山鄉', cleanDist: '冬山', lat: 24.636, lon: 121.792 },
            '270': { city: '宜蘭縣', district: '蘇澳鎮', cleanDist: '蘇澳', lat: 24.595, lon: 121.851 },
            '272': { city: '宜蘭縣', district: '南澳鄉', cleanDist: '南澳', lat: 24.462, lon: 121.800 },

            // 桃園市 (13)
            '320': { city: '桃園市', district: '中壢區', cleanDist: '中壢', lat: 24.965, lon: 121.225 },
            '324': { city: '桃園市', district: '平鎮區', cleanDist: '平鎮', lat: 24.945, lon: 121.218 },
            '325': { city: '桃園市', district: '龍潭區', cleanDist: '龍潭', lat: 24.863, lon: 121.216 },
            '326': { city: '桃園市', district: '楊梅區', cleanDist: '楊梅', lat: 24.908, lon: 121.146 },
            '327': { city: '桃園市', district: '新屋區', cleanDist: '新屋', lat: 24.972, lon: 121.106 },
            '328': { city: '桃園市', district: '觀音區', cleanDist: '觀音', lat: 25.034, lon: 121.082 },
            '330': { city: '桃園市', district: '桃園區', cleanDist: '桃園', lat: 24.993, lon: 121.301 },
            '333': { city: '桃園市', district: '龜山區', cleanDist: '龜山', lat: 24.996, lon: 121.338 },
            '334': { city: '桃園市', district: '八德區', cleanDist: '八德', lat: 24.938, lon: 121.284 },
            '335': { city: '桃園市', district: '大溪區', cleanDist: '大溪', lat: 24.884, lon: 121.287 },
            '336': { city: '桃園市', district: '復興區', cleanDist: '復興', lat: 24.821, lon: 121.352 },
            '337': { city: '桃園市', district: '大園區', cleanDist: '大園', lat: 25.064, lon: 121.196 },
            '338': { city: '桃園市', district: '蘆竹區', cleanDist: '蘆竹', lat: 25.045, lon: 121.293 },

            // 新竹市 & 新竹縣 (1+13)
            '300': { city: '新竹市', district: '新竹市', cleanDist: '新竹', lat: 24.803, lon: 120.968 },
            '302': { city: '新竹縣', district: '竹北市', cleanDist: '竹北', lat: 24.838, lon: 121.009 },
            '303': { city: '新竹縣', district: '湖口鄉', cleanDist: '湖口', lat: 24.904, lon: 121.043 },
            '304': { city: '新竹縣', district: '新豐鄉', cleanDist: '新豐', lat: 24.899, lon: 120.983 },
            '305': { city: '新竹縣', district: '新埔鎮', cleanDist: '新埔', lat: 24.828, lon: 121.073 },
            '306': { city: '新竹縣', district: '關西鎮', cleanDist: '關西', lat: 24.794, lon: 121.176 },
            '307': { city: '新竹縣', district: '芎林鄉', cleanDist: '芎林', lat: 24.774, lon: 121.079 },
            '308': { city: '新竹縣', district: '寶山鄉', cleanDist: '寶山', lat: 24.761, lon: 120.987 },
            '310': { city: '新竹縣', district: '竹東鎮', cleanDist: '竹東', lat: 24.733, lon: 121.092 },
            '311': { city: '新竹縣', district: '五峰鄉', cleanDist: '五峰', lat: 24.630, lon: 121.116 },
            '312': { city: '新竹縣', district: '橫山鄉', cleanDist: '橫山', lat: 24.721, lon: 121.139 },
            '313': { city: '新竹縣', district: '尖石鄉', cleanDist: '尖石', lat: 24.707, lon: 121.200 },
            '314': { city: '新竹縣', district: '北埔鄉', cleanDist: '北埔', lat: 24.699, lon: 121.057 },
            '315': { city: '新竹縣', district: '峨眉鄉', cleanDist: '峨眉', lat: 24.686, lon: 121.018 },

            // 苗栗縣 (18)
            '350': { city: '苗栗縣', district: '竹南鎮', cleanDist: '竹南', lat: 24.686, lon: 120.878 },
            '351': { city: '苗栗縣', district: '頭份市', cleanDist: '頭份', lat: 24.688, lon: 120.912 },
            '352': { city: '苗栗縣', district: '三灣鄉', cleanDist: '三灣', lat: 24.653, lon: 120.954 },
            '353': { city: '苗栗縣', district: '南庄鄉', cleanDist: '南庄', lat: 24.598, lon: 120.999 },
            '354': { city: '苗栗縣', district: '獅潭鄉', cleanDist: '獅潭', lat: 24.540, lon: 120.923 },
            '356': { city: '苗栗縣', district: '後龍鎮', cleanDist: '後龍', lat: 24.616, lon: 120.787 },
            '357': { city: '苗栗縣', district: '通霄鎮', cleanDist: '通霄', lat: 24.491, lon: 120.678 },
            '358': { city: '苗栗縣', district: '苑裡鎮', cleanDist: '苑裡', lat: 24.442, lon: 120.655 },
            '360': { city: '苗栗縣', district: '苗栗市', cleanDist: '苗栗', lat: 24.560, lon: 120.819 },
            '361': { city: '苗栗縣', district: '造橋鄉', cleanDist: '造橋', lat: 24.639, lon: 120.866 },
            '362': { city: '苗栗縣', district: '頭屋鄉', cleanDist: '頭屋', lat: 24.577, lon: 120.850 },
            '363': { city: '苗栗縣', district: '公館鄉', cleanDist: '公館', lat: 24.502, lon: 120.824 },
            '364': { city: '苗栗縣', district: '大湖鄉', cleanDist: '大湖', lat: 24.423, lon: 120.866 },
            '365': { city: '苗栗縣', district: '泰安鄉', cleanDist: '泰安', lat: 24.442, lon: 120.944 },
            '366': { city: '苗栗縣', district: '銅鑼鄉', cleanDist: '銅鑼', lat: 24.486, lon: 120.786 },
            '367': { city: '苗栗縣', district: '三義鄉', cleanDist: '三義', lat: 24.415, lon: 120.772 },
            '368': { city: '苗栗縣', district: '西湖鄉', cleanDist: '西湖', lat: 24.540, lon: 120.751 },
            '369': { city: '苗栗縣', district: '卓蘭鎮', cleanDist: '卓蘭', lat: 24.312, lon: 120.844 },

            // 台中市 (29)
            '400': { city: '台中市', district: '中區', cleanDist: '中區', lat: 24.142, lon: 120.683 },
            '401': { city: '台中市', district: '東區', cleanDist: '台中東區', lat: 24.136, lon: 120.693 },
            '402': { city: '台中市', district: '南區', cleanDist: '台中南區', lat: 24.120, lon: 120.662 },
            '403': { city: '台中市', district: '西區', cleanDist: '台中西區', lat: 24.143, lon: 120.663 },
            '404': { city: '台中市', district: '北區', cleanDist: '台中北區', lat: 24.161, lon: 120.683 },
            '406': { city: '台中市', district: '北屯區', cleanDist: '北屯', lat: 24.183, lon: 120.697 },
            '407': { city: '台中市', district: '西屯區', cleanDist: '西屯', lat: 24.162, lon: 120.640 },
            '408': { city: '台中市', district: '南屯區', cleanDist: '南屯', lat: 24.137, lon: 120.638 },
            '411': { city: '台中市', district: '太平區', cleanDist: '太平', lat: 24.127, lon: 120.718 },
            '412': { city: '台中市', district: '大里區', cleanDist: '大里', lat: 24.099, lon: 120.687 },
            '413': { city: '台中市', district: '霧峰區', cleanDist: '霧峰', lat: 24.062, lon: 120.699 },
            '414': { city: '台中市', district: '烏日區', cleanDist: '烏日', lat: 24.106, lon: 120.624 },
            '420': { city: '台中市', district: '豐原區', cleanDist: '豐原', lat: 24.252, lon: 120.718 },
            '421': { city: '台中市', district: '后里區', cleanDist: '后里', lat: 24.305, lon: 120.712 },
            '422': { city: '台中市', district: '石岡區', cleanDist: '石岡', lat: 24.275, lon: 120.781 },
            '423': { city: '台中市', district: '東勢區', cleanDist: '東勢', lat: 24.258, lon: 120.829 },
            '424': { city: '台中市', district: '和平區', cleanDist: '和平', lat: 24.244, lon: 121.003 },
            '426': { city: '台中市', district: '新社區', cleanDist: '新社', lat: 24.233, lon: 120.814 },
            '427': { city: '台中市', district: '潭子區', cleanDist: '潭子', lat: 24.209, lon: 120.706 },
            '428': { city: '台中市', district: '大雅區', cleanDist: '大雅', lat: 24.229, lon: 120.648 },
            '429': { city: '台中市', district: '神岡區', cleanDist: '神岡', lat: 24.260, lon: 120.662 },
            '432': { city: '台中市', district: '大肚區', cleanDist: '大肚', lat: 24.153, lon: 120.541 },
            '433': { city: '台中市', district: '沙鹿區', cleanDist: '沙鹿', lat: 24.233, lon: 120.563 },
            '434': { city: '台中市', district: '龍井區', cleanDist: '龍井', lat: 24.192, lon: 120.548 },
            '435': { city: '台中市', district: '梧棲區', cleanDist: '梧棲', lat: 24.255, lon: 120.532 },
            '436': { city: '台中市', district: '清水區', cleanDist: '清水', lat: 24.270, lon: 120.560 },
            '437': { city: '台中市', district: '大甲區', cleanDist: '大甲', lat: 24.349, lon: 120.622 },
            '438': { city: '台中市', district: '外埔區', cleanDist: '外埔', lat: 24.332, lon: 120.655 },
            '439': { city: '台中市', district: '大安區', cleanDist: '台中大安', lat: 24.345, lon: 120.585 },

            // 彰化縣 (26)
            '500': { city: '彰化縣', district: '彰化市', cleanDist: '彰化', lat: 24.081, lon: 120.541 },
            '502': { city: '彰化縣', district: '芬園鄉', cleanDist: '芬園', lat: 24.013, lon: 120.629 },
            '503': { city: '彰化縣', district: '花壇鄉', cleanDist: '花壇', lat: 24.028, lon: 120.539 },
            '504': { city: '彰化縣', district: '秀水鄉', cleanDist: '秀水', lat: 24.035, lon: 120.501 },
            '505': { city: '彰化縣', district: '鹿港鎮', cleanDist: '鹿港', lat: 24.056, lon: 120.435 },
            '506': { city: '彰化縣', district: '福興鄉', cleanDist: '福興', lat: 24.045, lon: 120.443 },
            '507': { city: '彰化縣', district: '線西鄉', cleanDist: '線西', lat: 24.129, lon: 120.466 },
            '508': { city: '彰化縣', district: '和美鎮', cleanDist: '和美', lat: 24.110, lon: 120.500 },
            '509': { city: '彰化縣', district: '伸港鄉', cleanDist: '伸港', lat: 24.145, lon: 120.488 },
            '510': { city: '彰化縣', district: '員林市', cleanDist: '員林', lat: 23.959, lon: 120.574 },
            '511': { city: '彰化縣', district: '社頭鄉', cleanDist: '社頭', lat: 23.896, lon: 120.586 },
            '512': { city: '彰化縣', district: '永靖鄉', cleanDist: '永靖', lat: 23.923, lon: 120.546 },
            '513': { city: '彰化縣', district: '埔心鄉', cleanDist: '埔心', lat: 23.954, lon: 120.549 },
            '514': { city: '彰化縣', district: '溪湖鎮', cleanDist: '溪湖', lat: 23.962, lon: 120.481 },
            '515': { city: '彰化縣', district: '大村鄉', cleanDist: '大村', lat: 23.993, lon: 120.542 },
            '516': { city: '彰化縣', district: '埔鹽鄉', cleanDist: '埔鹽', lat: 23.991, lon: 120.464 },
            '520': { city: '彰化縣', district: '田中鎮', cleanDist: '田中', lat: 23.861, lon: 120.584 },
            '521': { city: '彰化縣', district: '北斗鎮', cleanDist: '北斗', lat: 23.874, lon: 120.525 },
            '522': { city: '彰化縣', district: '田尾鄉', cleanDist: '田尾', lat: 23.891, lon: 120.526 },
            '523': { city: '彰化縣', district: '埤頭鄉', cleanDist: '埤頭', lat: 23.891, lon: 120.462 },
            '524': { city: '彰化縣', district: '溪州鄉', cleanDist: '溪州', lat: 23.854, lon: 120.499 },
            '525': { city: '彰化縣', district: '竹塘鄉', cleanDist: '竹塘', lat: 23.834, lon: 120.424 },
            '526': { city: '彰化縣', district: '二林鎮', cleanDist: '二林', lat: 23.899, lon: 120.375 },
            '527': { city: '彰化縣', district: '大城鄉', cleanDist: '大城', lat: 23.856, lon: 120.320 },
            '528': { city: '彰化縣', district: '芳苑鄉', cleanDist: '芳苑', lat: 23.924, lon: 120.320 },
            '530': { city: '彰化縣', district: '二水鄉', cleanDist: '二水', lat: 23.807, lon: 120.618 },

            // 南投縣 (13)
            '540': { city: '南投縣', district: '南投市', cleanDist: '南投', lat: 23.916, lon: 120.686 },
            '541': { city: '南投縣', district: '中寮鄉', cleanDist: '中寮', lat: 23.878, lon: 120.767 },
            '542': { city: '南投縣', district: '草屯鎮', cleanDist: '草屯', lat: 23.978, lon: 120.684 },
            '544': { city: '南投縣', district: '國姓鄉', cleanDist: '國姓', lat: 24.042, lon: 120.855 },
            '545': { city: '南投縣', district: '埔里鎮', cleanDist: '埔里', lat: 23.966, lon: 120.967 },
            '546': { city: '南投縣', district: '仁愛鄉', cleanDist: '仁愛', lat: 24.024, lon: 121.134 },
            '551': { city: '南投縣', district: '名間鄉', cleanDist: '名間', lat: 23.838, lon: 120.702 },
            '552': { city: '南投縣', district: '集集鎮', cleanDist: '集集', lat: 23.829, lon: 120.784 },
            '553': { city: '南投縣', district: '水里鄉', cleanDist: '水里', lat: 23.811, lon: 120.855 },
            '555': { city: '南投縣', district: '魚池鄉', cleanDist: '魚池', lat: 23.896, lon: 120.935 },
            '556': { city: '南投縣', district: '信義鄉', cleanDist: '信義', lat: 23.693, lon: 120.855 },
            '557': { city: '南投縣', district: '竹山鎮', cleanDist: '竹山', lat: 23.757, lon: 120.684 },
            '558': { city: '南投縣', district: '鹿谷鄉', cleanDist: '鹿谷', lat: 23.746, lon: 120.751 },

            // 雲林縣 (20)
            '630': { city: '雲林縣', district: '斗南鎮', cleanDist: '斗南', lat: 23.679, lon: 120.481 },
            '631': { city: '雲林縣', district: '大埤鄉', cleanDist: '大埤', lat: 23.646, lon: 120.431 },
            '632': { city: '雲林縣', district: '虎尾鎮', cleanDist: '虎尾', lat: 23.708, lon: 120.432 },
            '633': { city: '雲林縣', district: '土庫鎮', cleanDist: '土庫', lat: 23.696, lon: 120.363 },
            '634': { city: '雲林縣', district: '褒忠鄉', cleanDist: '褒忠', lat: 23.695, lon: 120.311 },
            '635': { city: '雲林縣', district: '東勢鄉', cleanDist: '東勢', lat: 23.675, lon: 120.254 },
            '636': { city: '雲林縣', district: '臺西鄉', cleanDist: '臺西', lat: 23.700, lon: 120.198 },
            '637': { city: '雲林縣', district: '崙背鄉', cleanDist: '崙背', lat: 23.759, lon: 120.354 },
            '638': { city: '雲林縣', district: '麥寮鄉', cleanDist: '麥寮', lat: 23.749, lon: 120.253 },
            '640': { city: '雲林縣', district: '斗六市', cleanDist: '斗六', lat: 23.708, lon: 120.544 },
            '643': { city: '雲林縣', district: '林內鄉', cleanDist: '林內', lat: 23.760, lon: 120.613 },
            '646': { city: '雲林縣', district: '古坑鄉', cleanDist: '古坑', lat: 23.642, lon: 120.562 },
            '647': { city: '雲林縣', district: '莿桐鄉', cleanDist: '莿桐', lat: 23.759, lon: 120.531 },
            '648': { city: '雲林縣', district: '西螺鎮', cleanDist: '西螺', lat: 23.797, lon: 120.463 },
            '649': { city: '雲林縣', district: '二崙鄉', cleanDist: '二崙', lat: 23.771, lon: 120.414 },
            '651': { city: '雲林縣', district: '北港鎮', cleanDist: '北港', lat: 23.575, lon: 120.303 },
            '652': { city: '雲林縣', district: '水林鄉', cleanDist: '水林', lat: 23.572, lon: 120.246 },
            '653': { city: '雲林縣', district: '口湖鄉', cleanDist: '口湖', lat: 23.582, lon: 120.188 },
            '654': { city: '雲林縣', district: '四湖鄉', cleanDist: '四湖', lat: 23.638, lon: 120.226 },
            '655': { city: '雲林縣', district: '元長鄉', cleanDist: '元長', lat: 23.649, lon: 120.315 },

            // 嘉義市 & 嘉義縣 (1+18)
            '600': { city: '嘉義市', district: '嘉義市', cleanDist: '嘉義', lat: 23.480, lon: 120.449 },
            '602': { city: '嘉義縣', district: '番路鄉', cleanDist: '番路', lat: 23.464, lon: 120.555 },
            '603': { city: '嘉義縣', district: '梅山鄉', cleanDist: '梅山', lat: 23.585, lon: 120.557 },
            '604': { city: '嘉義縣', district: '竹崎鄉', cleanDist: '竹崎', lat: 23.523, lon: 120.551 },
            '605': { city: '嘉義縣', district: '阿里山鄉', cleanDist: '阿里山', lat: 23.467, lon: 120.741 },
            '606': { city: '嘉義縣', district: '中埔鄉', cleanDist: '中埔', lat: 23.424, lon: 120.523 },
            '607': { city: '嘉義縣', district: '大埔鄉', cleanDist: '大埔', lat: 23.298, lon: 120.594 },
            '608': { city: '嘉義縣', district: '水上鄉', cleanDist: '水上', lat: 23.429, lon: 120.398 },
            '611': { city: '嘉義縣', district: '鹿草鄉', cleanDist: '鹿草', lat: 23.411, lon: 120.308 },
            '612': { city: '嘉義縣', district: '太保市', cleanDist: '太保', lat: 23.459, lon: 120.332 },
            '613': { city: '嘉義縣', district: '朴子市', cleanDist: '朴子', lat: 23.467, lon: 120.245 },
            '614': { city: '嘉義縣', district: '東石鄉', cleanDist: '東石', lat: 23.459, lon: 120.154 },
            '615': { city: '嘉義縣', district: '六腳鄉', cleanDist: '六腳', lat: 23.504, lon: 120.255 },
            '616': { city: '嘉義縣', district: '新港鄉', cleanDist: '新港', lat: 23.555, lon: 120.347 },
            '621': { city: '嘉義縣', district: '民雄鄉', cleanDist: '民雄', lat: 23.554, lon: 120.428 },
            '622': { city: '嘉義縣', district: '大林鎮', cleanDist: '大林', lat: 23.604, lon: 120.471 },
            '623': { city: '嘉義縣', district: '溪口鄉', cleanDist: '溪口', lat: 23.603, lon: 120.393 },
            '624': { city: '嘉義縣', district: '義竹鄉', cleanDist: '義竹', lat: 23.336, lon: 120.244 },
            '625': { city: '嘉義縣', district: '布袋鎮', cleanDist: '布袋', lat: 23.378, lon: 120.157 },

            // 台南市 (37)
            '700': { city: '台南市', district: '中西區', cleanDist: '中西區', lat: 22.992, lon: 120.199 },
            '701': { city: '台南市', district: '東區', cleanDist: '台南東區', lat: 22.986, lon: 120.224 },
            '702': { city: '台南市', district: '南區', cleanDist: '台南南區', lat: 22.960, lon: 120.194 },
            '704': { city: '台南市', district: '北區', cleanDist: '台南北區', lat: 23.007, lon: 120.207 },
            '708': { city: '台南市', district: '安平區', cleanDist: '安平', lat: 22.998, lon: 120.165 },
            '709': { city: '台南市', district: '安南區', cleanDist: '安南', lat: 23.048, lon: 120.185 },
            '710': { city: '台南市', district: '永康區', cleanDist: '永康', lat: 23.026, lon: 120.256 },
            '711': { city: '台南市', district: '歸仁區', cleanDist: '歸仁', lat: 22.967, lon: 120.293 },
            '712': { city: '台南市', district: '新化區', cleanDist: '新化', lat: 23.038, lon: 120.311 },
            '713': { city: '台南市', district: '左鎮區', cleanDist: '左鎮', lat: 23.058, lon: 120.407 },
            '714': { city: '台南市', district: '玉井區', cleanDist: '玉井', lat: 23.123, lon: 120.460 },
            '715': { city: '台南市', district: '楠西區', cleanDist: '楠西', lat: 23.174, lon: 120.485 },
            '716': { city: '台南市', district: '南化區', cleanDist: '南化', lat: 23.043, lon: 120.477 },
            '717': { city: '台南市', district: '仁德區', cleanDist: '仁德', lat: 22.962, lon: 120.251 },
            '718': { city: '台南市', district: '關廟區', cleanDist: '關廟', lat: 22.962, lon: 120.327 },
            '719': { city: '台南市', district: '龍崎區', cleanDist: '龍崎', lat: 22.965, lon: 120.362 },
            '720': { city: '台南市', district: '官田區', cleanDist: '官田', lat: 23.194, lon: 120.316 },
            '721': { city: '台南市', district: '麻豆區', cleanDist: '麻豆', lat: 23.181, lon: 120.248 },
            '722': { city: '台南市', district: '佳里區', cleanDist: '佳里', lat: 23.165, lon: 120.176 },
            '723': { city: '台南市', district: '西港區', cleanDist: '西港', lat: 23.122, lon: 120.203 },
            '724': { city: '台南市', district: '七股區', cleanDist: '七股', lat: 23.141, lon: 120.134 },
            '725': { city: '台南市', district: '將軍區', cleanDist: '將軍', lat: 23.199, lon: 120.157 },
            '726': { city: '台南市', district: '學甲區', cleanDist: '學甲', lat: 23.232, lon: 120.180 },
            '727': { city: '台南市', district: '北門區', cleanDist: '北門', lat: 23.267, lon: 120.126 },
            '730': { city: '台南市', district: '新營區', cleanDist: '新營', lat: 23.310, lon: 120.316 },
            '731': { city: '台南市', district: '後壁區', cleanDist: '後壁', lat: 23.366, lon: 120.361 },
            '732': { city: '台南市', district: '白河區', cleanDist: '白河', lat: 23.351, lon: 120.415 },
            '733': { city: '台南市', district: '東山區', cleanDist: '東山', lat: 23.325, lon: 120.404 },
            '734': { city: '台南市', district: '六甲區', cleanDist: '六甲', lat: 23.231, lon: 120.347 },
            '735': { city: '台南市', district: '下營區', cleanDist: '下營', lat: 23.235, lon: 120.264 },
            '736': { city: '台南市', district: '柳營區', cleanDist: '柳營', lat: 23.278, lon: 120.312 },
            '737': { city: '台南市', district: '鹽水區', cleanDist: '鹽水', lat: 23.320, lon: 120.266 },
            '741': { city: '台南市', district: '善化區', cleanDist: '善化', lat: 23.132, lon: 120.297 },
            '742': { city: '台南市', district: '大內區', cleanDist: '大內', lat: 23.120, lon: 120.350 },
            '743': { city: '台南市', district: '山上區', cleanDist: '山上', lat: 23.104, lon: 120.354 },
            '744': { city: '台南市', district: '新市區', cleanDist: '新市', lat: 23.078, lon: 120.295 },
            '745': { city: '台南市', district: '安定區', cleanDist: '安定', lat: 23.107, lon: 120.237 },

            // 高雄市 (38)
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
            '823': { city: '高雄市', district: '田寮區', cleanDist: '田寮', lat: 22.876, lon: 120.360 },
            '824': { city: '高雄市', district: '燕巢區', cleanDist: '燕巢', lat: 22.793, lon: 120.362 },
            '825': { city: '高雄市', district: '橋頭區', cleanDist: '橋頭', lat: 22.757, lon: 120.305 },
            '826': { city: '高雄市', district: '梓官區', cleanDist: '梓官', lat: 22.760, lon: 120.267 },
            '827': { city: '高雄市', district: '彌陀區', cleanDist: '彌陀', lat: 22.783, lon: 120.241 },
            '828': { city: '高雄市', district: '永安區', cleanDist: '永安', lat: 22.818, lon: 120.226 },
            '829': { city: '高雄市', district: '湖內區', cleanDist: '湖內', lat: 22.905, lon: 120.216 },
            '830': { city: '高雄市', district: '鳳山區', cleanDist: '鳳山', lat: 22.626, lon: 120.357 },
            '831': { city: '高雄市', district: '大寮區', cleanDist: '大寮', lat: 22.605, lon: 120.395 },
            '832': { city: '高雄市', district: '林園區', cleanDist: '林園', lat: 22.505, lon: 120.395 },
            '833': { city: '高雄市', district: '鳥松區', cleanDist: '鳥松', lat: 22.659, lon: 120.364 },
            '840': { city: '高雄市', district: '大樹區', cleanDist: '大樹', lat: 22.693, lon: 120.433 },
            '842': { city: '高雄市', district: '旗山區', cleanDist: '旗山', lat: 22.888, lon: 120.481 },
            '843': { city: '高雄市', district: '美濃區', cleanDist: '美濃', lat: 22.898, lon: 120.542 },
            '844': { city: '高雄市', district: '六龜區', cleanDist: '六龜', lat: 22.997, lon: 120.633 },
            '845': { city: '高雄市', district: '內門區', cleanDist: '內門', lat: 22.943, lon: 120.462 },
            '846': { city: '高雄市', district: '杉林區', cleanDist: '杉林', lat: 22.971, lon: 120.537 },
            '847': { city: '高雄市', district: '甲仙區', cleanDist: '甲仙', lat: 23.082, lon: 120.591 },
            '848': { city: '高雄市', district: '桃源區', cleanDist: '桃源', lat: 23.238, lon: 120.760 },
            '849': { city: '高雄市', district: '那瑪夏區', cleanDist: '那瑪夏', lat: 23.217, lon: 120.694 },
            '851': { city: '高雄市', district: '茂林區', cleanDist: '茂林', lat: 22.885, lon: 120.665 },
            '852': { city: '高雄市', district: '茄萣區', cleanDist: '茄萣', lat: 22.906, lon: 120.181 },

            // 屏東縣 (33)
            '900': { city: '屏東縣', district: '屏東市', cleanDist: '屏東', lat: 22.676, lon: 120.488 },
            '901': { city: '屏東縣', district: '三地門鄉', cleanDist: '三地門', lat: 22.714, lon: 120.654 },
            '902': { city: '屏東縣', district: '霧臺鄉', cleanDist: '霧臺', lat: 22.748, lon: 120.728 },
            '903': { city: '屏東縣', district: '瑪家鄉', cleanDist: '瑪家', lat: 22.648, lon: 120.649 },
            '904': { city: '屏東縣', district: '九如鄉', cleanDist: '九如', lat: 22.739, lon: 120.490 },
            '905': { city: '屏東縣', district: '里港鄉', cleanDist: '里港', lat: 22.779, lon: 120.494 },
            '906': { city: '屏東縣', district: '高樹鄉', cleanDist: '高樹', lat: 22.825, lon: 120.599 },
            '907': { city: '屏東縣', district: '鹽埔鄉', cleanDist: '鹽埔', lat: 22.753, lon: 120.573 },
            '908': { city: '屏東縣', district: '長治鄉', cleanDist: '長治', lat: 22.677, lon: 120.528 },
            '909': { city: '屏東縣', district: '麟洛鄉', cleanDist: '麟洛', lat: 22.651, lon: 120.527 },
            '911': { city: '屏東縣', district: '竹田鄉', cleanDist: '竹田', lat: 22.585, lon: 120.543 },
            '912': { city: '屏東縣', district: '內埔鄉', cleanDist: '內埔', lat: 22.615, lon: 120.567 },
            '913': { city: '屏東縣', district: '萬丹鄉', cleanDist: '萬丹', lat: 22.590, lon: 120.488 },
            '920': { city: '屏東縣', district: '潮州鎮', cleanDist: '潮州', lat: 22.550, lon: 120.542 },
            '921': { city: '屏東縣', district: '泰武鄉', cleanDist: '泰武', lat: 22.592, lon: 120.633 },
            '922': { city: '屏東縣', district: '來義鄉', cleanDist: '來義', lat: 22.525, lon: 120.627 },
            '923': { city: '屏東縣', district: '萬巒鄉', cleanDist: '萬巒', lat: 22.572, lon: 120.567 },
            '924': { city: '屏東縣', district: '崁頂鄉', cleanDist: '崁頂', lat: 22.514, lon: 120.514 },
            '925': { city: '屏東縣', district: '新埤鄉', cleanDist: '新埤', lat: 22.470, lon: 120.550 },
            '926': { city: '屏東縣', district: '南州鄉', cleanDist: '南州', lat: 22.490, lon: 120.510 },
            '927': { city: '屏東縣', district: '林邊鄉', cleanDist: '林邊', lat: 22.434, lon: 120.514 },
            '928': { city: '屏東縣', district: '東港鎮', cleanDist: '東港', lat: 22.467, lon: 120.453 },
            '929': { city: '屏東縣', district: '琉球鄉', cleanDist: '琉球', lat: 22.342, lon: 120.370 },
            '931': { city: '屏東縣', district: '佳冬鄉', cleanDist: '佳冬', lat: 22.418, lon: 120.551 },
            '932': { city: '屏東縣', district: '新園鄉', cleanDist: '新園', lat: 22.544, lon: 120.461 },
            '940': { city: '屏東縣', district: '枋寮鄉', cleanDist: '枋寮', lat: 22.366, lon: 120.594 },
            '941': { city: '屏東縣', district: '枋山鄉', cleanDist: '枋山', lat: 22.259, lon: 120.655 },
            '942': { city: '屏東縣', district: '春日鄉', cleanDist: '春日', lat: 22.371, lon: 120.627 },
            '943': { city: '屏東縣', district: '獅子鄉', cleanDist: '獅子', lat: 22.201, lon: 120.706 },
            '944': { city: '屏東縣', district: '車城鄉', cleanDist: '車城', lat: 22.073, lon: 120.711 },
            '945': { city: '屏東縣', district: '牡丹鄉', cleanDist: '牡丹', lat: 22.126, lon: 120.771 },
            '946': { city: '屏東縣', district: '恆春鎮', cleanDist: '恆春', lat: 22.004, lon: 120.744 },
            '947': { city: '屏東縣', district: '滿州鄉', cleanDist: '滿州', lat: 22.022, lon: 120.838 },

            // 台東縣 (16)
            '950': { city: '台東縣', district: '台東市', cleanDist: '台東', lat: 22.758, lon: 121.144 },
            '951': { city: '台東縣', district: '綠島鄉', cleanDist: '綠島', lat: 22.663, lon: 121.492 },
            '952': { city: '台東縣', district: '蘭嶼鄉', cleanDist: '蘭嶼', lat: 22.057, lon: 121.540 },
            '953': { city: '台東縣', district: '延平鄉', cleanDist: '延平', lat: 22.903, lon: 121.084 },
            '954': { city: '台東縣', district: '卑南鄉', cleanDist: '卑南', lat: 22.825, lon: 121.084 },
            '955': { city: '台東縣', district: '鹿野鄉', cleanDist: '鹿野', lat: 22.913, lon: 121.135 },
            '956': { city: '台東縣', district: '關山鎮', cleanDist: '關山', lat: 23.047, lon: 121.163 },
            '957': { city: '台東縣', district: '海端鄉', cleanDist: '海端', lat: 23.101, lon: 121.176 },
            '958': { city: '台東縣', district: '池上鄉', cleanDist: '池上', lat: 23.123, lon: 121.218 },
            '959': { city: '台東縣', district: '東河鄉', cleanDist: '東河', lat: 22.973, lon: 121.303 },
            '961': { city: '台東縣', district: '成功鎮', cleanDist: '成功', lat: 23.103, lon: 121.378 },
            '962': { city: '台東縣', district: '長濱鄉', cleanDist: '長濱', lat: 23.315, lon: 121.452 },
            '963': { city: '台東縣', district: '太麻里鄉', cleanDist: '太麻里', lat: 22.615, lon: 120.996 },
            '964': { city: '台東縣', district: '金峰鄉', cleanDist: '金峰', lat: 22.595, lon: 120.932 },
            '965': { city: '台東縣', district: '大武鄉', cleanDist: '大武', lat: 22.355, lon: 120.892 },
            '966': { city: '台東縣', district: '達仁鄉', cleanDist: '達仁', lat: 22.295, lon: 120.884 },

            // 花蓮縣 (13)
            '970': { city: '花蓮縣', district: '花蓮市', cleanDist: '花蓮', lat: 23.991, lon: 121.601 },
            '971': { city: '花蓮縣', district: '新城鄉', cleanDist: '新城', lat: 24.032, lon: 121.615 },
            '972': { city: '花蓮縣', district: '秀林鄉', cleanDist: '秀林', lat: 24.116, lon: 121.621 },
            '973': { city: '花蓮縣', district: '吉安鄉', cleanDist: '吉安', lat: 23.957, lon: 121.568 },
            '974': { city: '花蓮縣', district: '壽豐鄉', cleanDist: '壽豐', lat: 23.871, lon: 121.509 },
            '975': { city: '花蓮縣', district: '鳳林鎮', cleanDist: '鳳林', lat: 23.744, lon: 121.450 },
            '976': { city: '花蓮縣', district: '光復鄉', cleanDist: '光復', lat: 23.668, lon: 121.423 },
            '977': { city: '花蓮縣', district: '豐濱鄉', cleanDist: '豐濱', lat: 23.598, lon: 121.517 },
            '978': { city: '花蓮縣', district: '瑞穗鄉', cleanDist: '瑞穗', lat: 23.497, lon: 121.378 },
            '979': { city: '花蓮縣', district: '萬榮鄉', cleanDist: '萬榮', lat: 23.714, lon: 121.401 },
            '981': { city: '花蓮縣', district: '玉里鎮', cleanDist: '玉里', lat: 23.336, lon: 121.312 },
            '982': { city: '花蓮縣', district: '卓溪鄉', cleanDist: '卓溪', lat: 23.346, lon: 121.302 },
            '983': { city: '花蓮縣', district: '富里鄉', cleanDist: '富里', lat: 23.178, lon: 121.250 },

            // 澎湖縣 (6)
            '880': { city: '澎湖縣', district: '馬公市', cleanDist: '馬公', lat: 23.565, lon: 119.584 },
            '881': { city: '澎湖縣', district: '西嶼鄉', cleanDist: '西嶼', lat: 23.601, lon: 119.508 },
            '882': { city: '澎湖縣', district: '望安鄉', cleanDist: '望安', lat: 23.360, lon: 119.502 },
            '883': { city: '澎湖縣', district: '七美鄉', cleanDist: '七美', lat: 23.208, lon: 119.429 },
            '884': { city: '澎湖縣', district: '白沙鄉', cleanDist: '白沙', lat: 23.666, lon: 119.593 },
            '885': { city: '澎湖縣', district: '湖西鄉', cleanDist: '湖西', lat: 23.583, lon: 119.658 },

            // 金門縣 (6)
            '890': { city: '金門縣', district: '金沙鎮', cleanDist: '金沙', lat: 24.482, lon: 118.416 },
            '891': { city: '金門縣', district: '金湖鎮', cleanDist: '金湖', lat: 24.439, lon: 118.419 },
            '892': { city: '金門縣', district: '金寧鄉', cleanDist: '金寧', lat: 24.456, lon: 118.337 },
            '893': { city: '金城鎮', district: '金城鎮', cleanDist: '金城', lat: 24.432, lon: 118.318 },
            '894': { city: '金門縣', district: '烈嶼鄉', cleanDist: '烈嶼', lat: 24.428, lon: 118.246 },
            '896': { city: '金門縣', district: '烏坵鄉', cleanDist: '烏坵', lat: 24.988, lon: 119.453 },

            // 連江縣/馬祖 (4)
            '209': { city: '連江縣', district: '南竿鄉', cleanDist: '南竿', lat: 26.155, lon: 119.939 },
            '210': { city: '連江縣', district: '北竿鄉', cleanDist: '北竿', lat: 26.223, lon: 119.991 },
            '211': { city: '連江縣', district: '莒光鄉', cleanDist: '莒光', lat: 25.973, lon: 119.967 },
            '212': { city: '連江縣', district: '東引鄉', cleanDist: '東引', lat: 26.368, lon: 120.495 }
        };

        // 全台各門市實體店精確 GPS 經緯度資料庫 (62間實體店)
        const STORE_PRECISE_COORDS = {
            'TM天母': { lat: 25.1122, lon: 121.5238, city: '台北市', district: '士林區' },
            'TX淡新': { lat: 25.1878, lon: 121.4428, city: '新北市', district: '淡水區' },
            'SM三民': { lat: 25.0601, lon: 121.5627, city: '台北市', district: '松山區' },
            'NH內湖': { lat: 25.0602, lon: 121.5746, city: '台北市', district: '內湖區' },
            'CQ重慶': { lat: 25.0594, lon: 121.5134, city: '台北市', district: '大同區' },
            'IL宜蘭': { lat: 24.7533, lon: 121.7505, city: '宜蘭縣', district: '宜蘭市' },
            'KL桂林24': { lat: 25.0378, lon: 121.5061, city: '台北市', district: '萬華區' },
            'LJ蘆洲24': { lat: 25.0863, lon: 121.4925, city: '新北市', district: '三重區' },
            'HL花蓮': { lat: 24.0152, lon: 121.6053, city: '花蓮縣', district: '新城鄉' },
            'XK汐科': { lat: 25.0607, lon: 121.6521, city: '新北市', district: '汐止區' },
            'CX重新': { lat: 25.0487, lon: 121.4728, city: '新北市', district: '三重區' },
            'NN新南港': { lat: 25.0562, lon: 121.6112, city: '台北市', district: '南港區' },
            'ZP中平': { lat: 25.0478, lon: 121.4429, city: '新北市', district: '新莊區' },
            'PC板橋': { lat: 25.0182, lon: 121.4782, city: '新北市', district: '板橋區' },
            'JH中和': { lat: 25.0028, lon: 121.4983, city: '新北市', district: '中和區' },
            'HT新店': { lat: 24.9752, lon: 121.5446, city: '新北市', district: '新店區' },
            'TC土城': { lat: 24.9839, lon: 121.4589, city: '新北市', district: '土城區' },
            'SL樹林': { lat: 24.9961, lon: 121.4172, city: '新北市', district: '樹林區' },
            'CK經國': { lat: 25.0163, lon: 121.3056, city: '桃園市', district: '桃園區' },
            'LK林口': { lat: 25.0718, lon: 121.3682, city: '新北市', district: '林口區' },
            'CL中壢': { lat: 24.9538, lon: 121.2384, city: '桃園市', district: '中壢區' },
            'NL內壢': { lat: 24.9734, lon: 121.2582, city: '桃園市', district: '中壢區' },
            'PJ平鎮': { lat: 24.9189, lon: 121.2052, city: '桃園市', district: '平鎮區' },
            'ZY中原': { lat: 24.9576, lon: 121.2468, city: '桃園市', district: '中壢區' },
            'BA八德': { lat: 24.9452, lon: 121.2941, city: '桃園市', district: '八德區' },
            'BD北大': { lat: 24.9459, lon: 121.3782, city: '新北市', district: '樹林區' },
            'QP青埔': { lat: 24.9942, lon: 121.2045, city: '桃園市', district: '中壢區' },
            'ML苗栗': { lat: 24.5712, lon: 120.8248, city: '苗栗縣', district: '苗栗市' },
            'CS中清': { lat: 24.2042, lon: 120.6558, city: '台中市', district: '西屯區' },
            'CA青海': { lat: 24.1685, lon: 120.6472, city: '台中市', district: '西屯區' },
            'DA德安': { lat: 24.1352, lon: 120.6874, city: '台中市', district: '東區' },
            'NT南投': { lat: 23.9084, lon: 120.6865, city: '南投縣', district: '南投市' },
            'WS文心': { lat: 24.1482, lon: 120.6472, city: '台中市', district: '南屯區' },
            'ZH彰化': { lat: 24.0935, lon: 120.5368, city: '彰化縣', district: '彰化市' },
            'FY豐原': { lat: 24.2486, lon: 120.7102, city: '台中市', district: '豐原區' },
            'TP太平': { lat: 24.1315, lon: 120.7126, city: '台中市', district: '太平區' },
            'CY嘉義': { lat: 23.4735, lon: 120.4358, city: '嘉義市', district: '西區' },
            'DL斗六': { lat: 23.6982, lon: 120.5284, city: '雲林縣', district: '斗六市' },
            'XL沙鹿': { lat: 24.2384, lon: 120.5642, city: '台中市', district: '沙鹿區' },
            'XT西屯': { lat: 24.1842, lon: 120.6082, city: '台中市', district: '西屯區' },
            'BK北港': { lat: 23.5702, lon: 120.3015, city: '雲林縣', district: '北港鎮' },
            'PL埔里': { lat: 23.9721, lon: 120.9782, city: '南投縣', district: '埔里鎮' },
            'HW虎尾': { lat: 23.7125, lon: 120.4382, city: '雲林縣', district: '虎尾鎮' },
            'HY新營': { lat: 23.3082, lon: 120.3052, city: '台南市', district: '新營區' },
            'CC中正': { lat: 23.0372, lon: 120.2285, city: '台南市', district: '永康區' },
            'CH中華': { lat: 23.0082, lon: 120.2312, city: '台南市', district: '永康區' },
            'AP安平': { lat: 22.9982, lon: 120.1885, city: '台南市', district: '中西區' },
            'JT仁德': { lat: 22.9725, lon: 120.2502, city: '台南市', district: '仁德區' },
            'DS鼎山': { lat: 22.6562, lon: 120.3235, city: '高雄市', district: '三民區' },
            'LR愛河': { lat: 22.6318, lon: 120.2885, city: '高雄市', district: '前金區' },
            'WG五甲': { lat: 22.5937, lon: 120.3392, city: '高雄市', district: '鳳山區' },
            'FS鳳山': { lat: 22.6258, lon: 120.3508, city: '高雄市', district: '鳳山區' },
            'PT屏東': { lat: 22.6782, lon: 120.4905, city: '屏東縣', district: '屏東市' },
            'ZK成功': { lat: 22.6042, lon: 120.3045, city: '高雄市', district: '前鎮區' },
            'CG澄清': { lat: 22.6425, lon: 120.3440, city: '高雄市', district: '三民區' },
            'NZ楠梓': { lat: 22.7340, lon: 120.2865, city: '高雄市', district: '楠梓區' },
            'TA台東': { lat: 22.7552, lon: 121.1472, city: '台東縣', district: '台東市' },
            'KM金門': { lat: 24.4452, lon: 118.3412, city: '金門縣', district: '金寧鄉' },
            'XP新屏': { lat: 22.6652, lon: 120.4912, city: '屏東縣', district: '屏東市' },
            'XN新楠': { lat: 22.7380, lon: 120.3315, city: '高雄市', district: '楠梓區' },
            'XJ新仁': { lat: 22.9652, lon: 120.2285, city: '台南市', district: '仁德區' }
        };

        // 主要幹道與代表地標經緯度（精確定位至路段）
        const MAJOR_ROAD_COORDS = [
            { name: '和平二路', lat: 22.6145, lon: 120.3205, city: '高雄市', district: '前鎮/苓雅', cleanDist: '苓雅' },
            { name: '和平一路', lat: 22.6265, lon: 120.3205, city: '高雄市', district: '苓雅區', cleanDist: '苓雅' },
            { name: '光華二路', lat: 22.6158, lon: 120.3188, city: '高雄市', district: '前鎮區', cleanDist: '前鎮' },
            { name: '光華一路', lat: 22.6248, lon: 120.3188, city: '高雄市', district: '苓雅區', cleanDist: '苓雅' },
            { name: '三多一路', lat: 22.6225, lon: 120.3320, city: '高雄市', district: '苓雅區', cleanDist: '苓雅' },
            { name: '三多二路', lat: 22.6195, lon: 120.3205, city: '高雄市', district: '苓雅區', cleanDist: '苓雅' },
            { name: '三多三路', lat: 22.6165, lon: 120.3090, city: '高雄市', district: '前鎮/苓雅', cleanDist: '苓雅' },
            { name: '三多四路', lat: 22.6135, lon: 120.3005, city: '高雄市', district: '苓雅區', cleanDist: '苓雅' },
            { name: '中華五路', lat: 22.6042, lon: 120.3045, city: '高雄市', district: '前鎮區', cleanDist: '前鎮' },
            { name: '中華四路', lat: 22.6185, lon: 120.2985, city: '高雄市', district: '前金/苓雅', cleanDist: '前金' },
            { name: '五甲一路', lat: 22.6120, lon: 120.3540, city: '高雄市', district: '鳳山區', cleanDist: '鳳山' },
            { name: '五甲二路', lat: 22.5990, lon: 120.3420, city: '高雄市', district: '鳳山區', cleanDist: '鳳山' },
            { name: '五甲三路', lat: 22.5930, lon: 120.3320, city: '高雄市', district: '鳳山區', cleanDist: '鳳山' },
            { name: '鼎山街', lat: 22.6562, lon: 120.3235, city: '高雄市', district: '三民區', cleanDist: '三民' },
            { name: '澄清路', lat: 22.6425, lon: 120.3440, city: '高雄市', district: '三民區', cleanDist: '三民' },
            { name: '藍田路', lat: 22.7340, lon: 120.2865, city: '高雄市', district: '楠梓區', cleanDist: '楠梓' },
            { name: '土庫一路', lat: 22.7380, lon: 120.3315, city: '高雄市', district: '楠梓區', cleanDist: '楠梓' },
            { name: '河東路', lat: 22.6318, lon: 120.2885, city: '高雄市', district: '前金區', cleanDist: '前金' }
        ];

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

            // 1. Check major road coordinates for hyper-accurate street-level precision
            for (let i = 0; i < MAJOR_ROAD_COORDS.length; i++) {
                const road = MAJOR_ROAD_COORDS[i];
                if (text.includes(road.name)) {
                    if (road.city) {
                        const cityMatch = text.match(/(台北|新北|基隆|桃園|新竹|苗栗|台中|彰化|南投|雲林|嘉義|台南|高雄|屏東|宜蘭|花蓮|台東|澎湖|金門|連江)/);
                        if (cityMatch && !road.city.includes(cityMatch[1])) {
                            continue;
                        }
                    }
                    return road;
                }
            }
            
            // 2. Check leading 3-digit postal code (e.g. '802 高雄市苓雅區...')
            const zipMatch = text.match(/^(\d{3})/);
            if (zipMatch && TAIWAN_GEO_ZIP_MAP[zipMatch[1]]) {
                return TAIWAN_GEO_ZIP_MAP[zipMatch[1]];
            }

            // 3. Extract city if explicitly present in address (台北/新北/高雄/南投/花蓮...)
            const cityMatch = text.match(/(台北|新北|基隆|桃園|新竹|苗栗|台中|彰化|南投|雲林|嘉義|台南|高雄|屏東|宜蘭|花蓮|台東|澎湖|金門|連江)(?:市|縣)?/);
            const specifiedCity = cityMatch ? cityMatch[1] : null;

            // 4. Match full district name with suffix (e.g. '埔里鎮', '馬公市', '苓雅區', '大安區', '花蓮市')
            for (const zip of Object.keys(TAIWAN_GEO_ZIP_MAP)) {
                const item = TAIWAN_GEO_ZIP_MAP[zip];
                if (specifiedCity && !item.city.includes(specifiedCity)) continue;
                if (text.includes(item.district)) {
                    return item;
                }
            }

            // 5. Match clean district name (e.g. '苓雅', '大安', '楠梓') with city guard
            if (specifiedCity) {
                for (const zip of Object.keys(TAIWAN_GEO_ZIP_MAP)) {
                    const item = TAIWAN_GEO_ZIP_MAP[zip];
                    if (!item.city.includes(specifiedCity)) continue;
                    if (item.cleanDist.length >= 2 && text.includes(item.cleanDist)) {
                        return item;
                    }
                }
            } else {
                for (const zip of Object.keys(TAIWAN_GEO_ZIP_MAP)) {
                    const item = TAIWAN_GEO_ZIP_MAP[zip];
                    if (text.includes(item.district)) return item;
                    const regex = new RegExp(item.cleanDist + '(?:區|鄉|鎮|市)');
                    if (regex.test(text)) return item;
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
            if (!parsed.cleanDist && !parsed.city && !parsed.raw) return { parsed, topStore: null, top3Stores: [], alternatives: [] };

            const storesMap = ds.stores || {};
            const contacts = ds.contacts || [];

            const destLoc = parsed.loc;
            const candidates = [];

            contacts.forEach(c => {
                if (c.category && c.category.includes('MD')) return;
                const storeName = c['店名'] || '';
                const storeCode = c['代碼'] || '';
                const storeAddress = c['地址'] || '';
                const codeMatch = storeName.match(/^[A-Za-z]{2,3}/);
                const lookupKey = (codeMatch ? codeMatch[0] : (storeCode || storeName)).toUpperCase();
                
                // Use precise real-world store GPS coordinates
                let storeLoc = STORE_PRECISE_COORDS[storeName] || (lookupKey && STORE_PRECISE_COORDS[lookupKey]) || resolveLocationInfo(storeAddress);
                const freightData = storesMap[lookupKey] || storesMap[storeName] || null;

                const distKm = (destLoc && storeLoc) ? calculateGeoDistanceKm(destLoc.lat, destLoc.lon, storeLoc.lat, storeLoc.lon) : null;

                let isLocalStore = false;
                if (storeLoc && parsed.cleanDist && (storeLoc.cleanDist === parsed.cleanDist || (storeLoc.district && storeLoc.district.includes(parsed.cleanDist)))) {
                    if (!parsed.city || !storeLoc.city || parsed.city.slice(0, 2) === storeLoc.city.slice(0, 2)) {
                        isLocalStore = true;
                    }
                }

                let feeAmount = Infinity;
                let feeRaw = '';
                let matchedAreaText = '';

                if (freightData && freightData.fees && parsed.cleanDist) {
                    freightData.fees.forEach(f => {
                        const areaStr = String(f.area || '');
                        if (areaStr.includes(parsed.cleanDist)) {
                            const match = String(f.fee || '').match(/[0-9,]+/);
                            const num = match ? parseInt(match[0].replace(/,/g, ''), 10) : (f.fee.includes('0元') ? 0 : 0);
                            if (num < feeAmount) {
                                feeAmount = num;
                                feeRaw = f.fee;
                                matchedAreaText = f.area;
                            }
                        }
                    });
                }

                const isSameCity = (parsed.city && storeAddress.includes(parsed.city.slice(0, 2))) || (destLoc && storeLoc && destLoc.city === storeLoc.city);

                // Primary sort: Pure physical GPS distance (distKm)
                let sortScore = (distKm !== null ? distKm : 999);
                if (isLocalStore) {
                    sortScore = (distKm !== null ? distKm * 0.1 : 0);
                }

                let feeDisplayText = '';
                if (isLocalStore) {
                    feeDisplayText = '免跨店費 ($0 同區直出)';
                } else if (feeAmount !== Infinity) {
                    feeDisplayText = (feeAmount === 0 ? '免跨店費 ($0)' : ('運費 $' + feeAmount.toLocaleString()));
                } else if (distKm !== null) {
                    feeDisplayText = '約 ' + distKm + ' km (洽詢門市)';
                } else {
                    feeDisplayText = '依門市洽詢';
                }

                candidates.push({
                    contact: c,
                    freightData: freightData,
                    distKm: distKm,
                    feeAmount: feeAmount === Infinity ? (isLocalStore ? 0 : null) : feeAmount,
                    feeRaw: feeDisplayText,
                    matchedAreaText: matchedAreaText,
                    isLocalStore: isLocalStore,
                    isSameCity: isSameCity,
                    sortScore: sortScore
                });
            });

            candidates.sort((a, b) => a.sortScore - b.sortScore);

            return {
                parsed: parsed,
                topStore: candidates.length > 0 ? candidates[0] : null,
                top3Stores: candidates.slice(0, 3),
                alternatives: candidates.slice(3)
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

        function copySmartDispatchNote(storeName, storeCode, feeText, phone, address, destAddr, distKm) {
            if ('vibrate' in navigator) navigator.vibrate(12);
            playSingleClickSound("C5");

            const distInfo = (distKm !== null && distKm !== undefined) ? `\n直線距離：約 ${distKm} km` : '';
            const note = `【跨店出貨派工建議單】\n客戶送達地址：${destAddr || '指定目的地'}\n推薦出貨門市：${storeName} (代碼 ${storeCode})${distInfo}\n運費標準：${feeText}\n門市電話：${phone}\n門市地址：${address}\n(由 TIME 8 智慧選店系統產出)`;

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
                container.innerHTML = '<div style="text-align:center; padding:28px 16px; color:var(--label-tertiary);"><div style="font-size:24px; margin-bottom:6px; opacity:0.6;"><i class="fas fa-map-location-dot"></i></div><div style="font-size:13px; font-weight:600; color:var(--label);">請輸入送達地址或點選熱門區域</div><div style="font-size:11px; margin-top:3px; color:var(--label-tertiary);">系統將自動依真實 GPS 距離推薦最近 3 家出貨門市與運費</div></div>';
                return;
            }

            const analysis = getSmartStoreRecommendations(addressStr);
            const { parsed, top3Stores, alternatives } = analysis;

            if (!top3Stores || top3Stores.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:28px 16px; color:var(--label-tertiary);"><div style="font-size:24px; margin-bottom:6px; opacity:0.6;"><i class="fas fa-circle-question"></i></div><div style="font-size:13px; font-weight:600; color:var(--label);">查無匹配的門市資訊</div><div style="font-size:11px; margin-top:3px; color:var(--label-tertiary);">可嘗試輸入完整縣市與行政區（如：台南市麻豆區 或 屏東縣潮州鎮）</div></div>';
                return;
            }

            let html = '';

            // Header summary
            const destDisplay = (parsed.city || '') + (parsed.district || '') + (parsed.cleanDist && !parsed.district ? parsed.cleanDist : '');
            html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 2px;">';
            html += '<div style="font-size:12px; font-weight:700; color:var(--label); display:flex; align-items:center; gap:5px;"><i class="fas fa-location-crosshairs" style="color:var(--blue);"></i> 推薦最近 3 家出貨門市</div>';
            if (destDisplay) {
                html += '<div style="font-size:11px; font-weight:600; color:var(--label-secondary); background:var(--fill-secondary); padding:2px 8px; border-radius:6px;">📍 ' + escapeHtml(destDisplay) + '</div>';
            }
            html += '</div>';

            // Render Top 3 Stores
            const medals = [
                { rank: '👑 第 1 最近（首選）', bg: 'rgba(30,58,138,0.04)', border: 'rgba(30,58,138,0.3)', badgeBg: 'rgba(30,58,138,0.12)', badgeColor: 'var(--blue)' },
                { rank: '🥈 第 2 最近門市', bg: 'rgba(0,0,0,0.01)', border: 'var(--separator)', badgeBg: 'var(--fill-secondary)', badgeColor: 'var(--label-secondary)' },
                { rank: '🥉 第 3 最近門市', bg: 'rgba(0,0,0,0.01)', border: 'var(--separator)', badgeBg: 'var(--fill-secondary)', badgeColor: 'var(--label-secondary)' }
            ];

            top3Stores.forEach((item, index) => {
                const conf = medals[index] || medals[2];
                const c = item.contact;
                const storeName = c['店名'] || '門市';
                const storeCode = c['代碼'] || '';
                const storePhone = c['電話'] || '';
                const cleanPhone = storePhone.replace(/[^0-9+]/g, '');
                const storeAddress = c['地址'] || '';
                const storeManager = c['店長'] || '';
                const storeChief = c['課長'] || '';
                const storeDirector = c['處長'] || '';

                const parsedChief = parseStaffContact(storeChief);
                const parsedMgr = parseStaffContact(storeManager);

                const distLabel = item.distKm !== null ? `直線距離 ${item.distKm} km` : '同區門市';

                html += '<div class="store-card" style="border:1px solid ' + conf.border + '; background:var(--card); box-shadow:0 3px 12px rgba(0,0,0,0.04); margin-bottom:12px;">';
                
                // Card Header
                html += '<div class="store-card-header" style="background:' + conf.bg + '; padding:10px 14px;">';
                html += '<div>';
                html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">';
                html += '<span style="font-size:11px; font-weight:700; padding:1px 6px; border-radius:4px; background:' + conf.badgeBg + '; color:' + conf.badgeColor + ';">' + conf.rank + '</span>';
                if (item.isLocalStore) html += '<span style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; background:rgba(77,122,82,0.12); color:var(--green);">同區直出</span>';
                html += '</div>';
                html += '<div style="display:flex; align-items:baseline; gap:6px; margin-top:3px;">';
                html += '<span style="font-size:16px; font-weight:700; color:var(--label);">' + escapeHtml(storeName) + '</span>';
                if (storeCode) html += '<span class="store-badge-code">代碼 ' + escapeHtml(storeCode) + '</span>';
                html += '</div>';
                html += '</div>';

                html += '<div style="text-align:right;">';
                html += '<div style="font-size:13px; font-weight:700; color:var(--blue);">' + escapeHtml(distLabel) + '</div>';
                html += '<div style="font-size:12px; font-weight:600; color:var(--green); margin-top:2px;">' + escapeHtml(item.feeRaw) + '</div>';
                html += '</div>';
                html += '</div>';

                // Details Body
                html += '<div style="padding:10px 14px; font-size:12px; color:var(--label-secondary); line-height:1.6;">';
                if (parsedMgr.name) html += '<div style="display:flex; gap:6px; margin-bottom:2px;"><span style="color:var(--label-tertiary); width:36px;">店長</span><span style="font-weight:600; color:var(--label);">' + escapeHtml(parsedMgr.name) + '</span></div>';
                if (parsedChief.name) {
                    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:2px; flex-wrap:wrap;">';
                    html += '<span style="color:var(--label-tertiary); width:36px;">課長</span><span style="color:var(--label); font-weight:500;">' + escapeHtml(parsedChief.name) + '</span>';
                    if (parsedChief.email) html += '<a href="mailto:' + escapeHtml(parsedChief.email) + '" class="store-email-link active-scale"><span>' + escapeHtml(parsedChief.email) + '</span></a>';
                    html += '</div>';
                }
                if (storeAddress) html += '<div style="display:flex; gap:6px; margin-top:3px; padding-top:3px; border-top:0.5px solid var(--separator);"><span style="color:var(--label-tertiary); width:36px;">地址</span><span style="color:var(--label-secondary);">' + escapeHtml(storeAddress) + '</span></div>';
                html += '</div>';

                // Action Toolbar
                html += '<div style="padding:8px 14px 12px; display:flex; gap:8px;">';
                if (storePhone) {
                    html += '<a href="tel:' + cleanPhone + '" class="active-scale" style="flex:1; padding:8px; border-radius:10px; background:var(--blue); color:#fff; text-decoration:none; font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:4px;">';
                    html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
                    html += '<span>撥打電話</span>';
                    html += '</a>';
                }
                html += '<button type="button" onclick="copySmartDispatchNote(\'' + escapeHtml(storeName) + '\', \'' + escapeHtml(storeCode) + '\', \'' + escapeHtml(item.feeRaw) + '\', \'' + escapeHtml(storePhone.split(\'\\n\')[0]) + '\', \'' + escapeHtml(storeAddress) + '\', \'' + escapeHtml(parsed.raw) + '\', \'' + (item.distKm !== null ? item.distKm : '') + '\')" class="active-scale" style="flex:1; padding:8px; border-radius:10px; background:var(--fill-secondary); color:var(--label); border:0.5px solid var(--separator); font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">';
                html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';
                html += '<span>複製派工</span>';
                html += '</button>';
                if (storeAddress) {
                    html += '<a href="https://maps.apple.com/?q=' + encodeURIComponent(storeAddress) + '" target="_blank" class="active-scale" style="padding:8px 12px; border-radius:10px; background:var(--fill-secondary); color:var(--label); border:0.5px solid var(--separator); text-decoration:none; font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center;" title="在地圖中查看">';
                    html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>';
                    html += '</a>';
                }
                html += '</div>';

                html += '</div>';
            });

            // Collapsible Additional Stores (第 4~7 名)
            if (alternatives && alternatives.length > 0) {
                const otherList = alternatives.slice(0, 4);
                html += '<div style="margin-top:14px;">';
                html += '<div style="font-size:11px; font-weight:600; color:var(--label-tertiary); letter-spacing:0.04em; margin-bottom:6px;">🚚 其他鄰近支援門市</div>';
                html += '<div class="rounded-xl overflow-hidden" style="border:0.5px solid var(--separator); background:var(--card);">';
                otherList.forEach((alt, idx) => {
                    const altC = alt.contact;
                    const altName = altC['店名'] || '門市';
                    const altPhone = altC['電話'] || '';
                    const cleanAltPhone = altPhone.replace(/[^0-9+]/g, '');
                    const altDist = alt.distKm !== null ? `距離 ${alt.distKm} km` : '鄰近門市';

                    html += '<div style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; ' + (idx > 0 ? 'border-top:0.5px solid var(--separator);' : '') + '">';
                    html += '<div>';
                    html += '<div style="font-size:13.5px; font-weight:600; color:var(--label);">' + escapeHtml(altName) + ' <span class="store-badge-code">' + escapeHtml(altC['代碼'] || '') + '</span></div>';
                    html += '<div style="font-size:11px; color:var(--label-tertiary); margin-top:2px;">' + escapeHtml(altDist) + ' · ' + escapeHtml(alt.feeRaw) + '</div>';
                    html += '</div>';
                    html += '<div style="display:flex; align-items:center; gap:8px;">';
                    if (altPhone) {
                        html += '<a href="tel:' + cleanAltPhone + '" class="store-btn-call active-scale" style="padding:4px 10px; font-size:11px;">';
                        html += '<span>撥打</span>';
                        html += '</a>';
                    }
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
                html += '</div>';
            }
        }店名'] || '門市';
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
