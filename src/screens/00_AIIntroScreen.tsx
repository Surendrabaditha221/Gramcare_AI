import React, { useEffect, useState } from 'react';
import { HeartPulse, Sparkles, ShieldCheck } from 'lucide-react';

interface AIIntroScreenProps {
  onComplete: () => void;
}

export const AIIntroScreen: React.FC<AIIntroScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Stage 1: Begin smooth fade-out at 2200ms
    const fadeTimer = setTimeout(() => {
      setIsExiting(true);
    }, 2200);

    // Stage 2: Complete transition at 2500ms and navigate automatically
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`ai-intro-container ${isExiting ? 'ai-intro-exiting' : ''}`}>
      {/* Background Soft Ambient Light Spheres */}
      <div className="ai-intro-glow-1" />
      <div className="ai-intro-glow-2" />

      {/* Ambient Healthcare Sparkles Accent */}
      <Sparkles size={20} className="ai-intro-sparkle ai-sparkle-tl" color="#99f6e4" />
      <Sparkles size={24} className="ai-intro-sparkle ai-sparkle-tr" color="#99f6e4" />
      <Sparkles size={18} className="ai-intro-sparkle ai-sparkle-bl" color="#5eead4" />
      <Sparkles size={22} className="ai-intro-sparkle ai-sparkle-br" color="#5eead4" />

      {/* Center Logo with Pulse / Ripple Animated Rings */}
      <div className="ai-intro-logo-wrapper">
        <div className="ai-ripple-ring ai-ripple-1" />
        <div className="ai-ripple-ring ai-ripple-2" />
        <div className="ai-ripple-ring ai-ripple-3" />

        <div className="ai-intro-logo-card">
          <HeartPulse size={64} color="#0f766e" />
        </div>
      </div>

      {/* Fade-in Title & Subtitle */}
      <div className="ai-intro-text-wrapper">
        <h1 className="ai-intro-title">
          GramCare AI
        </h1>
        <p className="ai-intro-subtitle">
          Your Intelligent Rural Health Companion
        </p>
      </div>

      {/* Footer Security Badge */}
      <div className="ai-intro-footer">
        <ShieldCheck size={16} color="#99f6e4" />
        <span>Healthcare Companion • Commercial Quality & Secure</span>
      </div>
    </div>
  );
};
