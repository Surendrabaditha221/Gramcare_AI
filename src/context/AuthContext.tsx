import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '../services/firebase';
import {
  authLogin,
  authRegister,
  authGoogle,
  authPhone,
  authGetMe,
  authSetLanguage,
  checkBackendHealth,
  getApiBaseUrl,
  getLastProbeDetails,
  ApiError
} from '../services/api';

export interface AppUser {
  id: string;
  uid?: string;
  userId?: string;
  email: string | null;
  fullName: string | null;
  displayName?: string | null;
  profileImage?: string | null;
  photoURL?: string | null;
  authProvider?: string;
  language?: string;
  preferredLanguage?: string;
  profileCompleted?: boolean;
  isProfileCompleted?: boolean;
  isOnboardingCompleted?: boolean;
  healthProfile?: Record<string, any>;
  chatHistory?: any[];
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

interface AuthContextType {
  user: AppUser | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  serverHealthy: boolean | null;
  backendTargetUrl: string;
  backendErrorDetails: string | null;
  isReturningUser: boolean;
  loginWithEmail: (email: string, password: string) => Promise<AppUser | null>;
  registerWithEmail: (email: string, password: string, fullName?: string, preferredLanguage?: string) => Promise<AppUser | null>;
  loginWithGoogle: (idToken?: string, email?: string, fullName?: string, profileImage?: string) => Promise<AppUser | null>;
  loginWithFacebook: () => Promise<AppUser | null>;
  loginWithApple: () => Promise<AppUser | null>;
  loginWithPhone: (phoneNumber: string) => Promise<AppUser | null>;
  logout: () => Promise<void>;
  updateUserLanguage: (language: string) => Promise<void>;
  updateUserSession: (updatedUser: Partial<AppUser>) => void;
  checkServerConnection: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [serverHealthy, setServerHealthy] = useState<boolean | null>(null);
  const [backendTargetUrl, setBackendTargetUrl] = useState<string>(() => getApiBaseUrl());
  const [backendErrorDetails, setBackendErrorDetails] = useState<string | null>(null);

  const saveAuthSession = (token: string, refToken: string | null, userData: AppUser) => {
    const isCompleted = Boolean(
      localStorage.getItem('gramcare_onboarding_completed') === 'true' ||
      userData.profileCompleted ||
      userData.isProfileCompleted ||
      userData.isOnboardingCompleted
    );
    const enrichedUser: AppUser = {
      ...userData,
      profileCompleted: isCompleted,
      isProfileCompleted: isCompleted,
      isOnboardingCompleted: isCompleted,
    };
    if (isCompleted) {
      localStorage.setItem('gramcare_onboarding_completed', 'true');
    }
    setAccessToken(token);
    setUser(enrichedUser);
    localStorage.setItem('gramcare_access_token', token);
    if (refToken) localStorage.setItem('gramcare_refresh_token', refToken);
    localStorage.setItem('gramcare_auth_session', JSON.stringify(enrichedUser));
  };

  const clearAuthSession = () => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('gramcare_access_token');
    localStorage.removeItem('gramcare_refresh_token');
    localStorage.removeItem('gramcare_auth_session');
    localStorage.removeItem('gramcare_onboarding_completed');
  };

  useEffect(() => {
    let isMounted = true;

    // Hard safety timeout: Never allow loading state to persist longer than 3500ms
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        console.warn('[GramCare AI Auth] Session initialization reached safety timeout (3500ms). Releasing loading state.');
        setLoading(false);
      }
    }, 3500);

    const initSession = async () => {
      try {
        const storedToken = localStorage.getItem('gramcare_access_token');
        const storedSessionStr = localStorage.getItem('gramcare_auth_session');
        const isOnboardingDone = localStorage.getItem('gramcare_onboarding_completed') === 'true';

        let cachedUser: AppUser | null = null;
        if (storedSessionStr) {
          try {
            cachedUser = JSON.parse(storedSessionStr);
            if (cachedUser && (cachedUser.id || cachedUser.uid)) {
              if (isMounted) setUser(cachedUser);
            }
          } catch {}
        }

        if (storedToken) {
          if (isMounted) setAccessToken(storedToken);
          try {
            const backendUser = await authGetMe(storedToken);
            if (backendUser && (backendUser.id || backendUser.uid)) {
              const enriched = {
                ...backendUser,
                profileCompleted: backendUser.profileCompleted || isOnboardingDone,
                isProfileCompleted: backendUser.isProfileCompleted || isOnboardingDone,
                isOnboardingCompleted: backendUser.isOnboardingCompleted || isOnboardingDone,
              };
              if (isMounted) {
                setUser(enriched);
                setServerHealthy(true);
              }
              localStorage.setItem('gramcare_auth_session', JSON.stringify(enriched));
            } else if (!cachedUser) {
              clearAuthSession();
            }
          } catch (err: any) {
            console.warn('[GramCare AI Auth] Session token validation error:', err);
            if (err instanceof ApiError && err.statusCode === 401) {
              clearAuthSession();
            } else if (!cachedUser) {
              clearAuthSession();
            }
          }
        } else if (!cachedUser) {
          clearAuthSession();
        }
      } catch (globalInitErr) {
        console.error('[GramCare AI Auth] Unexpected error in session initialization:', globalInitErr);
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Firebase Auth client-state listener
    let unsubscribeFirebase: (() => void) | null = null;
    if (isFirebaseConfigured() && auth) {
      try {
        unsubscribeFirebase = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted) return;
          if (firebaseUser) {
            if (import.meta.env.DEV) {
              console.log('[GramCare AI Firebase Auth] Restoring authenticated user:', firebaseUser.uid, firebaseUser.email);
            }
            try {
              const idToken = await firebaseUser.getIdToken();
              const fbName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'GramCare User');
              const restoredUser: AppUser = {
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                userId: firebaseUser.uid,
                email: firebaseUser.email || null,
                fullName: fbName,
                displayName: fbName,
                photoURL: firebaseUser.photoURL || null,
                profileImage: firebaseUser.photoURL || null,
                authProvider: 'google',
                preferredLanguage: 'en'
              };
              saveAuthSession(idToken, null, restoredUser);
            } catch (fbErr) {
              console.warn('[GramCare AI Firebase Auth] Error restoring Firebase user token:', fbErr);
            }
          }
          if (isMounted) {
            setLoading(false);
          }
        });
      } catch (listenerErr) {
        console.warn('[GramCare AI Firebase Auth] Could not attach onAuthStateChanged listener:', listenerErr);
      }
    }

    initSession();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      if (unsubscribeFirebase) {
        unsubscribeFirebase();
      }
    };
  }, []);

  const loginWithEmail = async (email: string, password: string): Promise<AppUser | null> => {
    setError(null);
    setLoading(true);
    try {
      const res = await authLogin(email, password);
      if (res && res.access_token && res.user) {
        saveAuthSession(res.access_token, res.refresh_token || null, res.user);
        return res.user;
      }
      setError('Invalid email or password');
      return null;
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    fullName: string = '',
    preferredLanguage: string = 'en'
  ): Promise<AppUser | null> => {
    setError(null);
    setLoading(true);
    try {
      const res = await authRegister(email, password, fullName, preferredLanguage);
      if (res && res.access_token && res.user) {
        saveAuthSession(res.access_token, res.refresh_token || null, res.user);
        return res.user;
      }
      setError('Registration failed');
      return null;
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const checkServerConnection = async (maxAttempts: number = 2): Promise<boolean> => {
    const directUrl = getApiBaseUrl();
    setBackendTargetUrl(directUrl);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const health = await checkBackendHealth(true);
        const probe = getLastProbeDetails();
        setBackendTargetUrl(probe.targetUrl || directUrl);

        const isOk = Boolean(health && (health.status === 'ok' || health.status === 'running' || health.service || health.database));
        if (isOk) {
          setServerHealthy(true);
          setBackendErrorDetails(null);
          setError(prev => (prev && (prev.includes('server is offline') || prev.includes('offline') || prev.includes('Unable to reach GramCare server') || prev.includes('Unable to connect')) ? null : prev));
          return true;
        }
      } catch {
        // Retry
      }
      if (attempt < maxAttempts - 1) {
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
    setServerHealthy(false);
    setBackendErrorDetails(`Could not reach backend at ${directUrl}`);
    return false;
  };

  useEffect(() => {
    // Automatically verify connection on load with 2 attempts to allow backend startup time
    checkServerConnection(2);
  }, []);

  const loginWithGoogle = async (
    idToken?: string,
    email?: string,
    fullName?: string,
    profileImage?: string
  ): Promise<AppUser | null> => {
    setError(null);
    setBackendErrorDetails(null);
    // CRITICAL: Do NOT set global loading = true here!
    // LoginSignupScreen manages its own button-level spinner with activeProvider === 'google'.
    // Setting global loading = true causes AppRouter to unmount LoginSignupScreen, which breaks
    // mobile Chrome popup context and traps the UI on "Loading GramCare AI Session...".
    try {
      let finalIdToken = idToken;
      let finalEmail = email;
      let finalFullName = fullName;
      let finalProfileImage = profileImage;

      // Always trigger official Firebase Google Sign-In popup if no token supplied
      if (!finalIdToken) {
        if (!isFirebaseConfigured() || !auth) {
          throw new Error('Firebase Authentication is not configured. Please check your VITE_FIREBASE_* environment variables.');
        }

        // Always show Google Account Picker screen
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        // Add 90s safety timeout to popup promise so it can never hang indefinitely
        const popupPromise = signInWithPopup(auth, googleProvider);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Google sign-in timed out. Please try again.')), 90000);
        });

        const result = await Promise.race([popupPromise, timeoutPromise]);
        const googleUser = result.user;
        finalIdToken = await googleUser.getIdToken();
        finalEmail = googleUser.email || undefined;

        if (import.meta.env.DEV) {
          console.log('[GramCare AI Google Auth] Authenticated UID:', googleUser.uid);
          console.log('[GramCare AI Google Auth] Email:', googleUser.email);
          console.log('[GramCare AI Google Auth] Display Name:', googleUser.displayName);
        }

        let extractedName = googleUser.displayName || undefined;
        if (!extractedName && (result as any)._tokenResponse?.firstName) {
          const firstName = (result as any)._tokenResponse.firstName || '';
          const lastName = (result as any)._tokenResponse.lastName || '';
          extractedName = `${firstName} ${lastName}`.trim();
        }
        if (!extractedName && finalEmail) {
          extractedName = finalEmail.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        finalFullName = extractedName || undefined;
        finalProfileImage = googleUser.photoURL || undefined;
      }

      // 1. Attempt to sync with FastAPI backend
      try {
        const res = await authGoogle(
          finalIdToken,
          finalEmail || undefined,
          finalFullName || undefined,
          finalProfileImage
        );

        if (res && res.access_token && res.user) {
          setServerHealthy(true);
          setBackendErrorDetails(null);
          saveAuthSession(res.access_token, res.refresh_token || null, res.user);
          return res.user;
        }
      } catch (backendErr: any) {
        console.warn('[GramCare AI] Backend sync deferred (offline/starting):', backendErr?.message);
        setServerHealthy(false);
        setBackendErrorDetails(backendErr?.message || `Failed to sync with backend at ${getApiBaseUrl()}`);
      }

      // 2. Resilient Firebase Client Direct Fallback:
      // Google Firebase authentication succeeded! If local Python backend is offline or starting,
      // create/update the user directly in Cloud Firestore using the Firebase Client SDK.
      // This guarantees the user is NEVER blocked by server connection errors!
      const currentAuthUser = auth?.currentUser;
      const authenticatedUid = currentAuthUser?.uid || (finalEmail ? `usr_fb_${finalEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : null);

      if (authenticatedUid) {
        if (db) {
          try {
            const userDocRef = doc(db, 'users', authenticatedUid);
            const userSnap = await getDoc(userDocRef);
            if (!userSnap.exists()) {
              await setDoc(userDocRef, {
                uid: authenticatedUid,
                id: authenticatedUid,
                userId: authenticatedUid,
                email: finalEmail || null,
                displayName: finalFullName || 'GramCare User',
                fullName: finalFullName || 'GramCare User',
                photoURL: finalProfileImage || null,
                profileImage: finalProfileImage || null,
                authProvider: 'google',
                profileCompleted: false,
                isProfileCompleted: false,
                isOnboardingCompleted: false,
                preferredLanguage: 'en',
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
          } catch (firestoreErr) {
            console.warn('[GramCare AI] Firestore client direct write notice:', firestoreErr);
          }
        }

        const directUser: AppUser = {
          id: authenticatedUid,
          uid: authenticatedUid,
          userId: authenticatedUid,
          email: finalEmail || null,
          fullName: finalFullName || 'GramCare User',
          displayName: finalFullName || 'GramCare User',
          photoURL: finalProfileImage || null,
          profileImage: finalProfileImage || null,
          authProvider: 'google',
          preferredLanguage: 'en',
          profileCompleted: false,
          isProfileCompleted: false,
          isOnboardingCompleted: false
        };

        saveAuthSession(finalIdToken || 'firebase_client_session', null, directUser);
        return directUser;
      }

      clearAuthSession();
      setError('Authentication could not be completed. Please try again.');
      return null;
    } catch (err: any) {
      console.error('[GramCare AI] Google Auth Error:', err);
      clearAuthSession();
      let errorMessage = 'Google authentication failed. Please try again.';
      if (err?.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Google sign-in popup was closed before completing.';
      } else if (err?.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Google sign-in request was cancelled.';
      } else if (err?.code === 'auth/popup-blocked') {
        errorMessage = `Google sign-in popup was blocked by browser. Please tap the popup icon in your address bar to allow popups for ${typeof window !== 'undefined' ? window.location.origin : 'this site'}.`;
      } else if (err instanceof ApiError) {
        if (err.kind === 'NETWORK_UNAVAILABLE') {
          setServerHealthy(false);
          errorMessage = `GramCare backend is offline or unreachable at ${getApiBaseUrl()}. Please verify the backend is running.`;
        } else if (err.kind === 'TIMEOUT') {
          errorMessage = `Connection timed out reaching GramCare server at ${getApiBaseUrl()}. Please try again.`;
        } else if (err.kind === 'AUTH_FAILED') {
          errorMessage = err.detail || 'Authentication verification failed. Please try signing in again.';
        } else if (err.kind === 'SERVER_ERROR') {
          errorMessage = 'Healthcare server service is temporarily unavailable. Please retry in a moment.';
        } else {
          errorMessage = err.message || 'Unable to authenticate with GramCare server.';
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      return null;
    }
  };

  const loginWithFacebook = async (): Promise<AppUser | null> => {
    setError('Facebook sign-in is coming soon. Please sign in with Google.');
    return null;
  };

  const loginWithApple = async (): Promise<AppUser | null> => {
    setError('Apple sign-in is coming soon. Please sign in with Google.');
    return null;
  };

  const loginWithPhone = async (phoneNumber: string): Promise<AppUser | null> => {
    setError(null);
    setLoading(true);
    try {
      const res = await authPhone(phoneNumber);
      if (res && res.status === 'otp_sent') {
        setError(res.message || 'Verification code sent. Please check your SMS.');
        return null;
      } else if (res && res.status === 'gateway_unavailable') {
        setError(res.message || 'Phone OTP authentication is temporarily undergoing maintenance. Please sign in securely with Google.');
        return null;
      }
      setError('Phone sign-in is currently unavailable. Please sign in with Google.');
      return null;
    } catch (err: any) {
      if (err instanceof ApiError && err.kind === 'NETWORK_UNAVAILABLE') {
        setServerHealthy(false);
        setError('GramCare server is offline or unreachable. Please verify server connection.');
      } else if (err instanceof ApiError && err.kind === 'VALIDATION_FAILED') {
        setError(err.detail || 'Please enter a valid 10-digit Indian mobile number.');
      } else {
        setError(err?.message || 'Phone authentication service is unavailable. Please sign in with Google.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateUserLanguage = async (language: string): Promise<void> => {
    if (!user) return;
    const updatedUser = {
      ...user,
      language,
      preferredLanguage: language
    };
    setUser(updatedUser);
    localStorage.setItem('gramcare_auth_session', JSON.stringify(updatedUser));
    await authSetLanguage(language, accessToken || undefined);
  };

  const updateUserSession = (updatedFields: Partial<AppUser>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updatedFields };
    setUser(updatedUser);
    localStorage.setItem('gramcare_auth_session', JSON.stringify(updatedUser));
  };

  const logout = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      if (auth) {
        await firebaseSignOut(auth);
      }
    } catch (err) {
      console.warn('[GramCare AI] Firebase signout error:', err);
    } finally {
      clearAuthSession();
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const isReturningUser = Boolean(user && (user.profileCompleted || user.isProfileCompleted || user.isOnboardingCompleted));

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        error,
        serverHealthy,
        backendTargetUrl,
        backendErrorDetails,
        isReturningUser,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        loginWithFacebook,
        loginWithApple,
        loginWithPhone,
        logout,
        updateUserLanguage,
        updateUserSession,
        checkServerConnection,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
