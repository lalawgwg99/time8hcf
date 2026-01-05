# Firebase Cloud Messaging 設定指南

## 📱 步驟 1: 建立 Firebase 專案

### 1.1 前往 Firebase Console
1. 打開瀏覽器,前往: https://console.firebase.google.com/
2. 使用您的 Google 帳號登入

### 1.2 建立新專案
1. 點擊「新增專案」或「Add project」
2. 輸入專案名稱: `咕咕工時管理` (或任何您喜歡的名稱)
3. 點擊「繼續」
4. **Google Analytics**: 可以選擇「不啟用」(不需要)
5. 點擊「建立專案」
6. 等待專案建立完成 (約 30 秒)
7. 點擊「繼續」進入專案

---

## 🌐 步驟 2: 註冊 Web 應用程式

### 2.1 新增 Web App
1. 在 Firebase 專案首頁,點擊「Web」圖示 (`</>`)
2. 輸入應用程式暱稱: `工時管理 PWA`
3. ✅ **勾選**「同時為這個應用程式設定 Firebase Hosting」
4. 點擊「註冊應用程式」

### 2.2 複製設定資訊
您會看到類似以下的程式碼:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

**重要**: 請將這段設定複製並保存到記事本,稍後會用到!

---

## 🔔 步驟 3: 啟用 Cloud Messaging

### 3.1 啟用 FCM API
1. 在左側選單點擊「建構」→「Cloud Messaging」
2. 如果看到「開始使用」按鈕,點擊它
3. 系統會自動啟用 Firebase Cloud Messaging

### 3.2 取得伺服器金鑰 (Server Key)
1. 點擊左上角的「⚙️ 專案設定」
2. 選擇「Cloud Messaging」標籤
3. 找到「Cloud Messaging API (舊版)」區域
4. 如果看到「啟用」按鈕,點擊啟用
5. 複製「伺服器金鑰 (Server Key)」- 這很重要!

**格式範例**:
```
Server Key: AAAAxxxxxxx:APA91bFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**保存這個金鑰!** 稍後會用到。

### 3.3 取得 VAPID 金鑰
1. 在同一個「Cloud Messaging」標籤頁
2. 找到「Web 推送憑證」或「Web Push certificates」
3. 點擊「產生金鑰組」
4. 複製產生的「金鑰組」(VAPID Key)

**格式範例**:
```
VAPID Key: BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**保存這個金鑰!** 稍後會用到。

---

## 📝 步驟 4: 整理您的設定資訊

請將以下資訊整理好:

### ✅ Firebase 設定 (firebaseConfig)
```javascript
{
  apiKey: "您的 API Key",
  authDomain: "您的 Auth Domain",
  projectId: "您的 Project ID",
  storageBucket: "您的 Storage Bucket",
  messagingSenderId: "您的 Sender ID",
  appId: "您的 App ID"
}
```

### ✅ 伺服器金鑰 (Server Key)
```
AAAAxxxxxxx:APA91bFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### ✅ VAPID 金鑰 (Web Push Key)
```
BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🎯 完成後請告訴我

當您完成上述步驟後,請提供以下資訊:

1. ✅ Firebase 設定 (firebaseConfig)
2. ✅ VAPID 金鑰

**注意**: 
- ⚠️ **不要公開分享伺服器金鑰** (Server Key),這是私密資訊
- ✅ VAPID 金鑰可以放在前端代碼中,這是安全的
- ✅ firebaseConfig 可以放在前端代碼中,這是安全的

---

## 💡 常見問題

### Q: 需要付費嗎?
**A**: 不需要! Firebase 的免費方案 (Spark Plan) 已經足夠使用:
- 每月免費推播通知: 無限制
- 免費儲存空間: 1GB
- 免費資料庫讀寫: 每天 50,000 次

### Q: iOS 也支援嗎?
**A**: 支援,但有限制:
- ✅ Android Chrome: 完全支援,包括鎖屏通知
- ⚠️ iOS Safari (PWA): 支援推播,但需要將 App 加入主畫面
- ❌ iOS Safari (瀏覽器): 不支援推播通知

### Q: 安全嗎?
**A**: 非常安全!
- Firebase 使用 Google 的基礎設施
- 所有通訊都經過加密
- 符合 GDPR 和隱私法規

---

## 📞 需要協助?

如果在設定過程中遇到任何問題:
1. 截圖錯誤訊息
2. 告訴我您卡在哪一步
3. 我會立即協助您解決!

---

**準備好後,請提供您的 Firebase 設定資訊,我會立即幫您整合到應用程式中!** 🚀
