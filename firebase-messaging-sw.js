// Firebase Messaging Service Worker
// 這個文件處理背景推播通知

// ============================================
// 1. 匯入 Firebase SDK
// ============================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ============================================
// 2. Firebase 設定 (請替換為您的實際設定)
// ============================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// ============================================
// 3. 初始化 Firebase
// ============================================
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ============================================
// 4. 處理背景訊息
// ============================================
messaging.onBackgroundMessage((payload) => {
    console.log('📬 收到背景訊息:', payload);

    const notificationTitle = payload.notification.title || '⏰ 工時提醒';
    const notificationOptions = {
        body: payload.notification.body || '您有新的提醒',
        icon: payload.notification.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [400, 200, 400, 200, 400],
        tag: 'work-reminder',
        requireInteraction: true,
        data: {
            url: payload.data?.url || '/'
        }
    };

    // 顯示通知
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============================================
// 5. 處理通知點擊
// ============================================
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ 通知被點擊:', event);

    event.notification.close();

    // 打開或聚焦應用程式
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 如果已經有打開的視窗,就聚焦它
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // 否則打開新視窗
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// ============================================
// 6. Service Worker 安裝
// ============================================
self.addEventListener('install', (event) => {
    console.log('🔧 Firebase Service Worker 安裝中...');
    self.skipWaiting();
});

// ============================================
// 7. Service Worker 啟動
// ============================================
self.addEventListener('activate', (event) => {
    console.log('✅ Firebase Service Worker 已啟動');
    event.waitUntil(self.clients.claim());
});

console.log('🚀 Firebase Messaging Service Worker 已載入');
