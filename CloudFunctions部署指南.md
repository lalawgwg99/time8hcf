# Firebase Cloud Functions 部署指南

## 🎯 目的
這個 Cloud Function 用於排程推播通知,讓您的應用程式即使在鎖屏狀態下也能準時提醒。

---

## 📋 步驟 1: 安裝 Firebase CLI

### Windows:
```powershell
npm install -g firebase-tools
```

### 驗證安裝:
```powershell
firebase --version
```

---

## 🔐 步驟 2: 登入 Firebase

```powershell
firebase login
```

這會打開瀏覽器,請使用您的 Google 帳號登入。

---

## 📁 步驟 3: 初始化 Cloud Functions

在您的專案資料夾中執行:

```powershell
cd "c:\Users\user.DESKTOP-A01S3O1\OneDrive\Desktop\a時數計算"
firebase init functions
```

### 選項說明:
1. **選擇專案**: 選擇您剛才建立的 Firebase 專案
2. **語言**: 選擇 `JavaScript`
3. **ESLint**: 選擇 `No` (簡化設定)
4. **安裝依賴**: 選擇 `Yes`

---

## 📝 步驟 4: 編寫 Cloud Function

在 `functions/index.js` 中加入以下代碼:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// 排程推播通知
exports.scheduleNotification = functions.https.onRequest(async (req, res) => {
    // 啟用 CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    
    try {
        const { token, notification, triggerTime } = req.body;
        
        if (!token || !notification || !triggerTime) {
            res.status(400).json({ error: '缺少必要參數' });
            return;
        }
        
        // 計算延遲時間
        const now = Date.now();
        const trigger = new Date(triggerTime).getTime();
        const delay = trigger - now;
        
        if (delay <= 0) {
            res.status(400).json({ error: '觸發時間必須在未來' });
            return;
        }
        
        // 使用 Firestore 儲存排程
        const scheduleRef = admin.firestore().collection('notifications').doc();
        await scheduleRef.set({
            token: token,
            notification: notification,
            triggerTime: admin.firestore.Timestamp.fromDate(new Date(triggerTime)),
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ 通知已排程:', scheduleRef.id);
        
        res.status(200).json({ 
            success: true, 
            scheduleId: scheduleRef.id,
            message: '通知已成功排程'
        });
        
    } catch (error) {
        console.error('❌ 排程失敗:', error);
        res.status(500).json({ error: error.message });
    }
});

// 定時檢查並發送通知 (每分鐘執行一次)
exports.sendScheduledNotifications = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        const now = admin.firestore.Timestamp.now();
        
        // 查詢需要發送的通知
        const snapshot = await admin.firestore()
            .collection('notifications')
            .where('status', '==', 'pending')
            .where('triggerTime', '<=', now)
            .get();
        
        if (snapshot.empty) {
            console.log('📭 沒有待發送的通知');
            return null;
        }
        
        console.log(`📬 找到 ${snapshot.size} 個待發送的通知`);
        
        const promises = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // 發送推播通知
            const message = {
                token: data.token,
                notification: data.notification,
                webpush: {
                    notification: {
                        ...data.notification,
                        requireInteraction: true
                    }
                }
            };
            
            const promise = admin.messaging()
                .send(message)
                .then(() => {
                    console.log('✅ 通知已發送:', doc.id);
                    // 更新狀態為已發送
                    return doc.ref.update({ 
                        status: 'sent',
                        sentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                })
                .catch((error) => {
                    console.error('❌ 發送失敗:', doc.id, error);
                    // 更新狀態為失敗
                    return doc.ref.update({ 
                        status: 'failed',
                        error: error.message
                    });
                });
            
            promises.push(promise);
        });
        
        await Promise.all(promises);
        console.log('🎉 批次發送完成');
        
        return null;
    });
```

---

## 🚀 步驟 5: 部署 Cloud Functions

```powershell
firebase deploy --only functions
```

部署完成後,您會看到 Cloud Function 的 URL,例如:
```
https://us-central1-your-project.cloudfunctions.net/scheduleNotification
```

**請複製這個 URL!** 稍後會用到。

---

## 🔧 步驟 6: 更新前端代碼

在 `firebase-messaging.js` 中,將 `YOUR_CLOUD_FUNCTION_URL` 替換為您的實際 URL:

```javascript
const response = await fetch('https://us-central1-your-project.cloudfunctions.net/scheduleNotification', {
    // ... 其他代碼
});
```

---

## 💰 費用說明

### Spark Plan (免費方案):
- ✅ Cloud Functions: 每月 200 萬次呼叫
- ✅ Firestore: 每天 50,000 次讀取
- ✅ Cloud Messaging: 無限制

### 對於個人使用,完全免費!

---

## 🧪 測試

### 測試排程通知:
```javascript
// 在瀏覽器 Console 執行
await firebaseNotification.schedule(
    '測試通知',
    '這是一個測試訊息',
    1  // 1 分鐘後發送
);
```

### 檢查 Firestore:
1. 前往 Firebase Console
2. 點擊「Firestore Database」
3. 查看 `notifications` 集合
4. 應該會看到您的排程記錄

---

## ⚠️ 注意事項

1. **Cloud Functions 需要升級到 Blaze Plan (隨用隨付)**
   - 但免費額度非常高,個人使用不會產生費用
   - 需要綁定信用卡(但不會扣款,除非超過免費額度)

2. **替代方案: 使用第三方服務**
   - 如果不想升級,可以使用 Cloudflare Workers (完全免費)
   - 或使用 Vercel Serverless Functions (免費)

---

## 💡 需要協助?

如果您:
- ❓ 不想升級到 Blaze Plan
- ❓ 想使用完全免費的替代方案
- ❓ 遇到任何問題

請告訴我,我可以提供其他解決方案! 😊
