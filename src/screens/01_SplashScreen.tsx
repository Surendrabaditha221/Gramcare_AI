import React, { useEffect, useState } from 'react';
import { HeartPulse, ShieldCheck, Sparkles } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { playGramCareStartupSound } from '../utils/startupAudio';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const { lang } = useLanguage();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 1. Trigger audio synthesizer for startup chime & heartbeat (safely handled)
    const cleanupAudio = playGramCareStartupSound();

    // 2. Timeline Stage 1: Begin gentle fade-out transition at 1.7 seconds (1700ms)
    const fadeTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1700);

    // 3. Timeline Stage 2: Complete navigation transition at 2.0 seconds (2000ms)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
      cleanupAudio();
    };
  }, [onComplete]);

  return (
    <div className={`splash-container ${isExiting ? 'splash-exiting' : ''}`}>
      {/* Background Soft Ambient Light Spheres */}
      <div className="splash-bg-glow-1" />
      <div className="splash-bg-glow-2" />

      {/* Subtle Healthcare / AI Sparkles Accent */}
      <Sparkles size={16} className="splash-sparkle splash-sparkle-tl" />
      <Sparkles size={18} className="splash-sparkle splash-sparkle-tr" />
      <Sparkles size={15} className="splash-sparkle splash-sparkle-bl" />
      <Sparkles size={17} className="splash-sparkle splash-sparkle-br" />

      {/* Center Health Logo Card with Concentric Ripple Rings */}
      <div className="splash-logo-wrapper">
        <div className="splash-ripple-1" />
        <div className="splash-ripple-2" />
        <div className="splash-logo-card">
          <HeartPulse size={54} color="#0f766e" />
        </div>
      </div>

      {/* Shimmer / Light-Sweep Title */}
      <h1 className="splash-title">
        GramCare AI
      </h1>

      {/* Animated Primary Tagline */}
      <p className="splash-tagline" style={{ fontWeight: 700, fontSize: '17px', margin: '4px 0 2px 0' }}>
        Rural Healthcare, Closer to Every Family
      </p>

      {/* Supporting Text */}
      <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', opacity: 0.9 }}>
        AI-powered health guidance for every community.
      </p>

      {/* Subtle Loading Progress Bar */}
      <div style={{
        width: '120px',
        height: '3px',
        backgroundColor: '#e2e8f0',
        borderRadius: '3px',
        overflow: 'hidden',
        margin: '0 auto 24px auto'
      }}>
        <div style={{
          height: '100%',
          width: isExiting ? '100%' : '80%',
          backgroundColor: '#0f766e',
          borderRadius: '3px',
          transition: 'width 1.7s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>

      {/* Security & Quality Footer */}
      <div className="splash-footer">
        <ShieldCheck size={15} color="#0f766e" />
        <span>Healthcare Companion • Mobile First & Secure</span>
      </div>
    </div>
  );
};
