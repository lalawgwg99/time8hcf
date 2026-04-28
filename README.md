# Time8hcf / 一筆 Ippitsu

一個以「工時追蹤 + 專注管理 + 晶靈陪伴」為核心的 PWA。  
前端為單頁應用，主要資料儲存在本機瀏覽器。

## 主要功能

- 打卡上下班、今日工時圓環、每日目標進度
- 專注 session（25/50/90）與休息循環、分心紀錄
- 晶靈 Seiki 成長、成就系統、商店外觀與道具
- 通知提醒（工作提醒 / 休息提醒 / 久坐伸展）與策略模板
- 行事曆匯出（ICS）與資料 JSON 備份匯入匯出
- 休假 iCal 同步、AI 對話與摘要（經 `/api/chat` 代理）

## 通知策略模板

設定頁內建三種提醒模板，可一鍵套用：

- 溫和：較長工作時段、較寬鬆休息節奏
- 嚴格：較密集提醒，適合防過勞
- 深度工作日：平衡專注時段與短休息

另外可手動調整：

- 上班後提醒（分鐘）
- 休息結束提醒（分鐘）
- 久坐伸展提醒（分鐘）

## 晶靈商店

商店包含五類內容：

- 色系主題
- 光暈效果
- 表情模組
- 思考軌跡
- 實用道具（消耗型，即買即用）

積分來源包含日登入、互動、專注完成、升等等事件。

## 專案結構

```text
index.html              # 主頁（目前為 inline script 架構）
manifest.json           # PWA manifest
sw.js                   # Service Worker
functions/api/chat.js   # 聊天/AI 代理 API
src/domain/timecard.js  # 工時領域邏輯（可測試模組）
tests/timecard.test.js  # 工時領域測試
```

## 本機執行

直接開啟 `index.html` 可使用主要功能。  
若要測試 PWA/SW 行為，建議用本機伺服器啟動（避免 `file://` 限制）。

## 測試

```bash
node tests/timecard.test.js
```

## 資料與隱私

- 使用者工時與設定主要存放在 `localStorage`
- 匯入 JSON 會覆蓋目前資料，建議先匯出備份
- AI 功能僅透過 `functions/api/chat.js` 代理請求，不直接暴露前端金鑰

## 部署

此 repo 可直接部署為靜態站，並搭配 `functions/api/chat.js` 提供 API。  
若部署到 Cloudflare Pages，請確認函式路徑與環境變數設定完整。

## 後續建議

- 將 `index.html` script 拆分為模組化檔案（UI / domain / infra）
- 將 focus 與 shop 行為補上更多自動化測試
- 匯入流程加入「預覽差異 + 二次確認」
