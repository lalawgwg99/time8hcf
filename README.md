# 一筆 Ippitsu — 工時紀錄

帶有禪意美學的工時追蹤 Web App。純前端 PWA，資料僅存於瀏覽器 localStorage。

## 設計理念

以日本書道「一筆書き」為核心隱喻——整個工作日是一道不間斷的筆觸。

- **色彩**：宣紙米白 + 竹青 + 墨黑，三色幾乎單色系統
- **排版**：Cormorant Garamond 巨型工時數字 + Noto Sans TC 正文
- **進度**：有機弧度 SVG 筆觸，從左往右實時延伸
- **互動**：墨滴打卡動畫、環境呼吸光、0.5s 水墨緩動
- **夜間**：20:00 後自動切換為墨水深黑模式

## 功能

- 一鍵打卡上下班，滑動確認下班
- 筆觸進度即時顯示工時百分比
- 工作精靈（能量晶種）陪伴成長
- 本週工時圖表與平均統計
- AI 下班生活指南（依時段推薦活動）
- 即時新聞摘要
- 休假日曆同步（支援 iCal）
- 久坐伸展提醒 / 工時超時警報
- 匯出工時紀錄至日曆 (.ics)

## 技術

- HTML5 / Vanilla JS / Tailwind CSS (CDN)
- Cormorant Garamond + Noto Serif TC (Google Fonts)
- Tone.js 音效 / Font Awesome 圖示
- AI 接口：`/api/ai` proxy
- PWA：離線可用，可加入主畫面

## 使用

開啟 `index.html` 即可使用，支援 iOS / Android 加入主畫面。

## 隱私

打卡資料僅儲存於瀏覽器 localStorage，不上傳任何伺服器。AI 功能僅傳送打卡時間片段。
