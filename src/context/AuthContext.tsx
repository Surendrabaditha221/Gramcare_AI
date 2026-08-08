import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  AuthProvider as FirebaseAuthProvider
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  facebookProvider,
  appleProvider,
  isFirebaseConfigured
} from '../services/firebase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  loginWithPhone: (phoneNumber: string) => Promise<AppUser | null>;
  loginWithGoogle: () => Promise<AppUser | null>;
  loginWithFacebook: () => Promise<AppUser | null>;
  loginWithApple: () => Promise<AppUser | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatAuthError = (err: any, providerName: string): string => {
  console.error(`[GramCare AI Auth Error] ${providerName} Sign-In Failed:`, err);

  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in was cancelled.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Pop-up blocked by browser. Please allow pop-ups for this site and try again.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'This email is already associated with another sign-in method.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Unable to sign in. Please check your internet connection and try again.';
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    if (providerName === 'Facebook') {
      return 'Facebook provider requires Firebase/Facebook Developer configuration.';
    }
    if (providerName === 'Apple') {
      return 'Apple provider requires Firebase/Apple Developer configuration.';
    }
    return `${providerName} provider is not enabled in Firebase Console.`;
  }
  if (code === 'auth/unauthorized-domain') {
    return `This domain is not authorized for ${providerName} Sign-In in Firebase Console.`;
  }

  return err?.message || `${providerName} Sign-In failed. Please try again.`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('gramcare_auth_session');
      if (savedSession) {
        setUser(JSON.parse(savedSession));
      }
    } catch {}

    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const appUser: AppUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            providerId: fbUser.providerData?.[0]?.providerId
          };
          setUser(appUser);
          localStorage.setItem('gramcare_auth_session', JSON.stringify(appUser));
        } else {
          setUser(null);
          localStorage.removeItem('gramcare_auth_session');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firebase AuthStateChanged error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const loginWithPhone = async (phoneNumber: string): Promise<AppUser | null> => {
    setError(null);
    setLoading(true);
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const appUser: AppUser = {
        uid: `phone_${cleanPhone}`,
        email: null,
        displayName: null,
        photoURL: null,
        providerId: 'phone'
      };
      setUser(appUser);
      localStorage.setItem('gramcare_auth_session', JSON.stringify(appUser));
      return appUser;
    } catch (err: any) {
      setError(err?.message || 'Phone authentication failed.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginWithProvider = async (
    provider: FirebaseAuthProvider,
    providerName: string
  ): Promise<AppUser | null> => {
    setError(null);

    if (!isFirebaseConfigured()) {
      const configErrMsg =
        'Firebase configuration is missing! Please populate VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in your .env file.';
      console.error('[GramCare AI Auth]', configErrMsg);
      setError(configErrMsg);
      return null;
    }

    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      const appUser: AppUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
        providerId: fbUser.providerData?.[0]?.providerId
      };

      setUser(appUser);
      localStorage.setItem('gramcare_auth_session', JSON.stringify(appUser));
      console.log(`[GramCare AI Auth] Successfully authenticated ${providerName} user:`, appUser);
      return appUser;
    } catch (err: any) {
      const userFriendlyMsg = formatAuthError(err, providerName);
      setError(userFriendlyMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = () => loginWithProvider(googleProvider, 'Google');
  const loginWithFacebook = () => loginWithProvider(facebookProvider, 'Facebook');
  const loginWithApple = () => loginWithProvider(appleProvider, 'Apple');

  const logout = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      if (isFirebaseConfigured()) {
        await firebaseSignOut(auth);
      }
      setUser(null);
      localStorage.removeItem('gramcare_auth_session');
      console.log('[GramCare AI Auth] User logged out successfully.');
    } catch (err: any) {
      console.error('[GramCare AI Auth Error] Logout failed:', err);
      setError(err.message || 'Logout failed.');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginWithPhone,
        loginWithGoogle,
        loginWithFacebook,
        loginWithApple,
        logout,
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
