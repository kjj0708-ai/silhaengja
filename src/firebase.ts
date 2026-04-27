import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, browserLocalPersistence, setPersistence, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
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
      await setPersistence(auth, browserLocalPersistence);
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

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
};
