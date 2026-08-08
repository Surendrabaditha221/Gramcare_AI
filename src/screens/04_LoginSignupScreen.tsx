import React, { useState } from 'react';
import { HeartPulse, Loader2, AlertCircle, WifiOff, Phone, ArrowRight } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PrimaryButton } from '../components/Common/PrimaryButton';

interface LoginSignupScreenProps {
  onSuccess: () => void;
}

type AuthProviderType = 'phone' | 'google' | 'facebook' | 'apple';

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const FacebookIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" style={{ flexShrink: 0 }}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const AppleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#000000" style={{ flexShrink: 0 }}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.13-1.97.99-3.12-1.02.04-2.22.68-2.92 1.5-.62.72-1.16 1.89-1.01 3.02 1.13.09 2.27-.57 2.94-1.4" />
  </svg>
);

export const LoginSignupScreen: React.FC<LoginSignupScreenProps> = ({ onSuccess }) => {
  const { t, lang } = useLanguage();
  const { rawBrowserOnline } = useOnlineStatus();
  const { loginWithPhone, loginWithGoogle, loginWithFacebook, loginWithApple, loading, error, clearError } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<AuthProviderType | null>(null);

  const isAuthAllowed = rawBrowserOnline;

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    clearError();

    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setActiveProvider('phone');
    const userObj = await loginWithPhone(`+91${digitsOnly.slice(-10)}`);
    setActiveProvider(null);

    if (userObj) {
      onSuccess();
    }
  };

  const handleProviderLogin = async (provider: AuthProviderType) => {
    if (!isAuthAllowed || loading) return;
    clearError();
    setActiveProvider(provider);

    let appUser = null;
    if (provider === 'google') {
      appUser = await loginWithGoogle();
    } else if (provider === 'facebook') {
      appUser = await loginWithFacebook();
    } else if (provider === 'apple') {
      appUser = await loginWithApple();
    }

    setActiveProvider(null);
    if (appUser) {
      onSuccess();
    }
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '380px',
    height: '48px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease-in-out',
    margin: '0 auto'
  };

  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', minHeight: '88vh', justifyContent: 'space-between', maxWidth: '520px', margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <div style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '50%',
          width: '72px',
          height: '72px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px'
        }}>
          <HeartPulse size={40} color="#0f766e" />
        </div>

        <h2 style={{ fontSize: '24px', color: '#0f766e', marginBottom: '4px', fontWeight: 800 }}>
          Welcome to GramCare
        </h2>

        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
          Access healthcare guidance for you and your family.
        </p>

        {/* Offline Warning Banner */}
        {!rawBrowserOnline && (
          <div style={{
            backgroundColor: '#fff7ed',
            border: '1.5px solid #fed7aa',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <WifiOff size={20} color="#c2410c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#9a3412', marginBottom: '2px' }}>
                {lang === 'te' ? 'ఆఫ్‌లైన్ మోడ్' : "You're offline"}
              </div>
              <div style={{ fontSize: '12px', color: '#c2410c', lineHeight: 1.4 }}>
                {lang === 'te'
                  ? 'సైన్ ఇన్ చేయడానికి ఇంటర్నెట్ కనెక్షన్ అవసరం.'
                  : 'Internet connection is required to sign in.'}
              </div>
            </div>
          </div>
        )}

        {/* Error Banners */}
        {(error || phoneError) && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', marginBottom: '2px' }}>
                Authentication Notice
              </div>
              <div style={{ fontSize: '12px', color: '#b91c1c', lineHeight: 1.4 }}>
                {phoneError || error}
              </div>
            </div>
          </div>
        )}

        {/* Phone Authentication Form */}
        <form onSubmit={handlePhoneLogin} style={{ width: '100%', maxWidth: '380px', margin: '0 auto 24px auto', textAlign: 'left' }}>
          <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
            Mobile Phone Number *
          </label>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              backgroundColor: '#f1f5f9',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 700,
              color: '#334155',
              fontSize: '15px'
            }}>
              🇮🇳 +91
            </div>

            <input
              type="tel"
              required
              maxLength={10}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 10-digit mobile number"
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <PrimaryButton
            type="submit"
            disabled={loading || phoneNumber.length < 10}
            style={{
              width: '100%',
              minHeight: '48px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 700,
              opacity: phoneNumber.length >= 10 ? 1 : 0.6
            }}
          >
            {loading && activeProvider === 'phone' ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Continue with Phone Number</span>
                <ArrowRight size={18} />
              </>
            )}
          </PrimaryButton>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', maxWidth: '380px', margin: '0 auto 20px auto' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          <span style={{ padding: '0 12px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
        </div>

        {/* OAuth Buttons Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          {/* Google Button */}
          <button
            type="button"
            aria-label="Continue with Google"
            onClick={() => handleProviderLogin('google')}
            disabled={loading || !isAuthAllowed}
            className="btn"
            style={{
              ...buttonStyle,
              backgroundColor: isAuthAllowed ? '#ffffff' : '#f1f5f9',
              border: `1.5px solid ${isAuthAllowed ? '#cbd5e1' : '#e2e8f0'}`,
              color: isAuthAllowed ? '#334155' : '#94a3b8',
              cursor: isAuthAllowed && !loading ? 'pointer' : 'not-allowed',
              opacity: loading || !isAuthAllowed ? 0.7 : 1
            }}
          >
            {loading && activeProvider === 'google' ? (
              <>
                <Loader2 size={20} color="#0f766e" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>{t.continueGoogle || 'Continue with Google'}</span>
              </>
            )}
          </button>

          {/* Facebook Button */}
          <button
            type="button"
            aria-label="Continue with Facebook"
            onClick={() => handleProviderLogin('facebook')}
            disabled={loading || !isAuthAllowed}
            className="btn"
            style={{
              ...buttonStyle,
              backgroundColor: isAuthAllowed ? '#ffffff' : '#f1f5f9',
              border: `1.5px solid ${isAuthAllowed ? '#cbd5e1' : '#e2e8f0'}`,
              color: isAuthAllowed ? '#1e293b' : '#94a3b8',
              cursor: isAuthAllowed && !loading ? 'pointer' : 'not-allowed',
              opacity: loading || !isAuthAllowed ? 0.7 : 1
            }}
          >
            {loading && activeProvider === 'facebook' ? (
              <>
                <Loader2 size={20} color="#1877F2" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Connecting to Facebook...</span>
              </>
            ) : (
              <>
                <FacebookIcon />
                <span>{t.continueFacebook || 'Continue with Facebook'}</span>
              </>
            )}
          </button>

          {/* Apple Button */}
          <button
            type="button"
            aria-label="Continue with Apple"
            onClick={() => handleProviderLogin('apple')}
            disabled={loading || !isAuthAllowed}
            className="btn"
            style={{
              ...buttonStyle,
              backgroundColor: isAuthAllowed ? '#ffffff' : '#f1f5f9',
              border: `1.5px solid ${isAuthAllowed ? '#cbd5e1' : '#e2e8f0'}`,
              color: isAuthAllowed ? '#0f172a' : '#94a3b8',
              cursor: isAuthAllowed && !loading ? 'pointer' : 'not-allowed',
              opacity: loading || !isAuthAllowed ? 0.7 : 1
            }}
          >
            {loading && activeProvider === 'apple' ? (
              <>
                <Loader2 size={20} color="#0f172a" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Connecting to Apple...</span>
              </>
            ) : (
              <>
                <AppleIcon />
                <span>{t.continueApple || 'Continue with Apple'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div>
        <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', lineHeight: 1.4, margin: '16px 0 0 0' }}>
          By continuing, you agree to GramCare's Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
};
