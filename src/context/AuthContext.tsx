import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';
import {
  authLogin,
  authRegister,
  authGoogle,
  authGetMe,
  authSetLanguage
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
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    const initSession = async () => {
      const storedToken = localStorage.getItem('gramcare_access_token');
      const isOnboardingDone = localStorage.getItem('gramcare_onboarding_completed') === 'true';

      if (storedToken) {
        setAccessToken(storedToken);
        try {
          const backendUser = await authGetMe(storedToken);
          if (backendUser && (backendUser.id || backendUser.uid)) {
            const enriched = {
              ...backendUser,
              profileCompleted: backendUser.profileCompleted || isOnboardingDone,
              isProfileCompleted: backendUser.isProfileCompleted || isOnboardingDone,
              isOnboardingCompleted: backendUser.isOnboardingCompleted || isOnboardingDone,
            };
            setUser(enriched);
            localStorage.setItem('gramcare_auth_session', JSON.stringify(enriched));
          } else {
            clearAuthSession();
          }
        } catch {
          // Token invalid, expired, or backend rejected
          clearAuthSession();
        }
      } else {
        clearAuthSession();
      }
      setLoading(false);
    };

    initSession();
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

  const loginWithGoogle = async (
    idToken?: string,
    email?: string,
    fullName?: string,
    profileImage?: string
  ): Promise<AppUser | null> => {
    setError(null);
    setLoading(true);
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

        const result = await signInWithPopup(auth, googleProvider);
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

      // Verify ID token & authenticate/register user in MongoDB backend
      const res = await authGoogle(
        finalIdToken,
        finalEmail || undefined,
        finalFullName || undefined,
        finalProfileImage
      );

      if (res && res.access_token && res.user) {
        saveAuthSession(res.access_token, res.refresh_token || null, res.user);
        return res.user;
      }

      // No fake fallback user! If backend is offline/unreachable, fail cleanly.
      clearAuthSession();
      setError('Unable to connect to GramCare server. Please try again.');
      return null;
    } catch (err: any) {
      console.error('[GramCare AI] Google Auth Error:', err);
      clearAuthSession();
      let errorMessage = err?.message || 'Google authentication failed';
      if (err?.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Google sign-in popup was closed before completing.';
      } else if (err?.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Google sign-in request was cancelled.';
      } else if (err?.code === 'auth/popup-blocked') {
        errorMessage = 'Google sign-in popup was blocked by browser. Please allow popups for this site.';
      }
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
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

  const loginWithPhone = async (_phoneNumber: string): Promise<AppUser | null> => {
    setError('Phone sign-in is coming soon. Please sign in with Google.');
    return null;
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
