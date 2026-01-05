// Firebase Cloud Messaging 整合代碼
// 這個文件包含所有需要的 FCM 功能

// ============================================
// 1. Firebase 設定 (請替換為您的實際設定)
// ============================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const vapidKey = "YOUR_VAPID_KEY";

// ============================================
// 2. 初始化 Firebase
// ============================================
let messaging = null;
let userToken = null;

async function initializeFirebase() {
    try {
        // 動態載入 Firebase SDK
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

        // 初始化 Firebase
        const app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);

        console.log('✅ Firebase 初始化成功');

        // 請求通知權限並取得 Token
        await requestNotificationPermission();

        // 監聽前台訊息
        onMessage(messaging, (payload) => {
            console.log('📬 收到前台訊息:', payload);
            showNotification(payload.notification.title, payload.notification.body);
        });

    } catch (error) {
        console.error('❌ Firebase 初始化失敗:', error);
    }
}

// ============================================
// 3. 請求通知權限並取得 Token
// ============================================
async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('✅ 通知權限已授予');

            // 取得 FCM Token
            const { getToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');
            userToken = await getToken(messaging, { vapidKey: vapidKey });

            console.log('🔑 FCM Token:', userToken);

            // 儲存 Token 到 localStorage
            localStorage.setItem('fcmToken', userToken);

            return userToken;
        } else {
            console.log('❌ 通知權限被拒絕');
            return null;
        }
    } catch (error) {
        console.error('❌ 取得通知權限失敗:', error);
        return null;
    }
}

// ============================================
// 4. 排程推播通知 (使用 Cloud Functions)
// ============================================
async function scheduleNotification(title, body, delayMinutes) {
    if (!userToken) {
        console.error('❌ 尚未取得 FCM Token');
        return false;
    }

    try {
        // 計算觸發時間
        const triggerTime = new Date(Date.now() + delayMinutes * 60 * 1000);

        // 發送請求到 Cloud Function (需要部署)
        const response = await fetch('YOUR_CLOUD_FUNCTION_URL', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: userToken,
                notification: {
                    title: title,
                    body: body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    vibrate: [400, 200, 400, 200, 400]
                },
                triggerTime: triggerTime.toISOString()
            })
        });

        if (response.ok) {
            console.log('✅ 推播通知已排程:', triggerTime);
            return true;
        } else {
            console.error('❌ 排程失敗:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('❌ 排程推播通知失敗:', error);
        return false;
    }
}

// ============================================
// 5. 顯示本地通知 (前台使用)
// ============================================
function showNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [400, 200, 400, 200, 400],
            tag: 'work-reminder',
            requireInteraction: true
        });

        // 播放音效
        playSoundReminder();
    }
}

// ============================================
// 6. 整合到現有的打卡功能
// ============================================
function punchWithNotification() {
    const now = new Date();
    const type = getNextPunchType();

    // 原有的打卡邏輯
    const taskInput = document.getElementById('taskInput');
    let taskName = "";
    if (type === 'in' && taskInput) {
        taskName = taskInput.value.trim();
        taskInput.value = "";
    }

    punchRecords.push({
        time: now.toISOString(),
        type: type,
        task: taskName
    });

    saveData();
    updateDisplay();

    // 新增: 排程 FCM 推播通知
    if (type === 'in') {
        // 上班打卡 - 排程工作提醒
        const workReminderMinutes = appSettings.workReminderMinutes || 180;
        scheduleNotification(
            '⏰ 工作提醒',
            '工作一段時間了,記得休息一下!',
            workReminderMinutes
        );
        console.log(`📅 已排程工作提醒: ${workReminderMinutes} 分鐘後`);
    } else {
        // 下班打卡 - 排程休息提醒
        const restReminderMinutes = appSettings.restReminderMinutes || 30;
        scheduleNotification(
            '🌙 休息提醒',
            '休息時間差不多囉,準備上工?',
            restReminderMinutes
        );
        console.log(`📅 已排程休息提醒: ${restReminderMinutes} 分鐘後`);
    }
}

// ============================================
// 7. 頁面載入時初始化
// ============================================
window.addEventListener('load', () => {
    // 延遲初始化 Firebase,避免阻塞頁面載入
    setTimeout(() => {
        initializeFirebase();
    }, 2000);
});

// ============================================
// 8. 匯出函數供外部使用
// ============================================
window.firebaseNotification = {
    init: initializeFirebase,
    schedule: scheduleNotification,
    show: showNotification
};
