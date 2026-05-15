importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDn4-vZOiXfu5fawVCImQoJFhdgkiY3sdg",
  authDomain: "project-25bbfa50-adce-447f-8db.firebaseapp.com",
  projectId: "project-25bbfa50-adce-447f-8db",
  storageBucket: "project-25bbfa50-adce-447f-8db.firebasestorage.app",
  messagingSenderId: "582902478382",
  appId: "1:582902478382:web:b7f3ac443d4e01630851bf"
});

const messaging = firebase.messaging();

// 앱이 백그라운드/종료 상태일 때 수신
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '실행자들';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon:  '/logo.png',
    badge: '/logo.png',
    data:  { url: 'https://shj.choshg.com' }
  });
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://shj.choshg.com';
  event.waitUntil(clients.openWindow(url));
});
