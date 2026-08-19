/**
 * Firebase Initialization Module for GramCare AI
 * Configured using environment variables (VITE_FIREBASE_*)
 */
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/**
 * Check whether Firebase environment variables are provided
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY.trim() !== '' &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID.trim() !== ''
  );
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);

    // Development diagnostic logging (safe, no secrets exposed)
    if (import.meta.env.DEV) {
      console.log('[GramCare AI Firebase] Connected to Project ID:', firebaseConfig.projectId);
      console.log('[GramCare AI Firebase] Auth Domain:', firebaseConfig.authDomain);
      console.log('[GramCare AI Firebase] Firestore Status: Initialized (ready for users/{uid})');
    }
  } catch (error) {
    console.warn('[GramCare AI] Firebase initialization error:', error);
  }
} else {
  console.info('[GramCare AI] Firebase environment configuration not set. Please add VITE_FIREBASE_* keys to .env file.');
}

export const auth = authInstance as Auth;
export const db = dbInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const facebookProvider = new FacebookAuthProvider();

export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');


