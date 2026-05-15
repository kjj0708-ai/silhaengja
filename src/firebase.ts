import { initializeApp } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, browserPopupRedirectResolver, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const VAPID_KEY = 'BK_ZRP5ww_NanPydx37qc7Oqgdp1Y5sJvO4s4GLr3CCBeWR3yDq8Yy6WfrjRX65DWkx5MIHlh-XVywKNViMyPVs';

const app = initializeApp(firebaseConfig);

// popupRedirectResolver 필수 — 없으면 signInWithRedirect가 auth/argument-error 발생
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
// Use the exact database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export const testFirestoreConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
    return true;
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      // Permission denied means it successfully talked to Firestore!
      console.log("Firestore connection successful (verified by rules rejection)");
      return true;
    }
    // Also ignore testing-only environments complaining about permissions
    console.error("Firestore connection test failed:", error);
    if (error.message?.includes('the client is offline')) {
      throw new Error("네트워크 연결이 오프라인 상태이거나 방화벽에 의해 차단되었습니다.");
    }
    return false;
  }
};

export const googleProvider = new GoogleAuthProvider();

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export const loginWithGoogle = async () => {
  try {
    if (isIOS()) {
      await signInWithRedirect(auth, googleProvider);
      return null; // 페이지가 리다이렉트됨, onAuthStateChanged가 처리
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google login failed", error);
    throw error;
  }
};

export const handleRedirectResult = async () => {
  try {
    await getRedirectResult(auth);
  } catch (error: any) {
    console.error("Redirect result error:", error);
    throw error;
  }
};

// 한글 포함 아이디를 안전한 이메일로 변환 (base64 인코딩)
const toEmail = (id: string) => {
  const safe = btoa(encodeURIComponent(id.trim().toLowerCase())).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  return `${safe}@shj.choshg.com`;
};

export const loginWithPin = async (id: string, pin: string) => {
  const email = toEmail(id);
  try {
    const result = await signInWithEmailAndPassword(auth, email, pin);
    return result.user;
  } catch (err: any) {
    // 계정 없으면 자동 생성
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      const result = await createUserWithEmailAndPassword(auth, email, pin);
      return result.user;
    }
    throw err;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
};

// ── FCM: 권한 요청 + 토큰 Firestore 저장 ──────────────────────────────
export const registerFCMToken = async (userId: string): Promise<void> => {
  try {
    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;

    // 이미 거부된 경우 조용히 종료
    if (Notification.permission === 'denied') return;

    // 권한 요청 (granted이면 바로 진행)
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    // Service Worker 등록 (아직 안 됐을 경우 대비)
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return;

    // Firestore user 문서에 토큰 저장
    await updateDoc(doc(db, 'users', userId), { fcmToken: token });
    console.log('FCM token registered:', token.slice(0, 20) + '...');
  } catch (err) {
    // 토큰 저장 실패는 앱 동작에 영향 없음
    console.warn('FCM token registration failed (non-fatal):', err);
  }
};

// ── FCM: 포그라운드 메시지 수신 (앱이 열려있을 때) ──────────────────
export const onForegroundMessage = (callback: (title: string, body: string) => void) => {
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? '실행자들';
      const body  = payload.notification?.body  ?? '';
      callback(title, body);
    });
  } catch {
    return () => {};
  }
};
