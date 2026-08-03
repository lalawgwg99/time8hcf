工時紀錄

帶有禪意美學的工時追蹤 Web App。純前端 PWA，資料僅存於瀏覽器 localStorage。

## 設計理念

以日本書道「一筆書き」為核心隱喻——整個工作日是一道不間斷的筆觸。

- **色彩**：宣紙米白 `#F4EFE6` + 竹青 `#6E7D6A` + 墨棕 `#8B6840`，低彩度和風系統
- **排版**：Cormorant Garamond 巨型工時數字 + Noto Sans TC / Noto Serif TC 正文
- **進度**：有機弧度 SVG 筆觸環，即時呈現工時百分比
- **互動**：墨滴打卡動畫、環境呼吸光、水墨緩動曲線
- **夜間**：20:00 後自動切換為墨水深黑模式

## 功能

### 核心
- 一鍵打卡上下班，滑動確認下班
- 筆觸進度環即時顯示工時百分比
- 工作備註（選填）記錄每日工作內容

### 精靈系統（Seiki 能量晶種）
- 7 階段進化：晶卵 → 晶芽 → 晶童 → 晶騎 → 晶尊 → 晶皇 → 晶神
- 累計工時獲得經驗值，自動升級並觸發視覺特效
- 精靈具備表情系統（暖機、專注、疲倦、沉睡等情緒）
- 靈氣光環（Stardust / Aurora）隨等級與狀態切換

### 統計與洞察
- 本週工時圖表與平均統計
- 工作階段時間軸（上下班紀錄）
- 匯出工時紀錄至日曆 (.ics)
- 匯入 / 復原資料功能

### 生活輔助
- AI 下班生活指南（依時段推薦活動）
- 即時新聞摘要
- 休假日曆同步（支援 Google 日曆 / iCal）
- 久坐伸展提醒 / 工時超時警報

## 技術

- HTML5 / Vanilla JS / Tailwind CSS (CDN)
- Cormorant Garamond + Noto Serif TC + Noto Sans TC (Google Fonts)
- Tone.js 音效回饋 / Font Awesome 圖示
- AI 接口：`/api/ai` proxy
- PWA：離線可用，可加入主畫面
- Service Worker：network-first 策略

## 檔案結構

```
index.html    — 主頁面（含 HTML + inline CSS + JS）
style.css     — Ippitsu Zen 設計系統樣式
app.js        — 核心邏輯（打卡、精靈、統計、AI）
manifest.json — PWA manifest
sw.js         — Service Worker
```

## 使用

開啟 `index.html` 即可使用，支援 iOS / Android 加入主畫面。

## 隱私

打卡資料僅儲存於瀏覽器 localStorage，不上傳任何伺服器。AI 功能僅傳送打卡時間片段。
