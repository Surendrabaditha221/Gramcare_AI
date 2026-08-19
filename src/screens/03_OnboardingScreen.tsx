import React, { useState } from 'react';
import { Bot, FileText, Stethoscope, ArrowRight, ChevronRight } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { PrimaryButton } from '../components/Common/PrimaryButton';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'slide_1',
      icon: <Bot size={60} color="#0f766e" />,
      title: 'AI Health Assistance',
      description: 'Instant AI-powered health guidance in your preferred language.'
    },
    {
      id: 'slide_2',
      icon: <FileText size={60} color="#0f766e" />,
      title: 'Health Records',
      description: 'Securely store and access your health records anytime.'
    },
    {
      id: 'slide_3',
      icon: <Stethoscope size={60} color="#0f766e" />,
      title: 'Emergency & Village Healthcare',
      description: 'Connect with nearby healthcare services, emergency support, and village health workers.'
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const activeSlide = slides[currentSlide];

  return (
    <div style={{
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '88vh',
      justifyContent: 'space-between',
      maxWidth: '560px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Top Header Bar with Skip Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e', letterSpacing: '0.5px' }}>
          STEP {currentSlide + 1} OF 3
        </span>

        <button
          type="button"
          onClick={onComplete}
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#64748b',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          {t.skip || 'Skip'}
        </button>
      </div>

      {/* Slide Content with Dynamic Keyframe Transition Key */}
      <div
        key={activeSlide.id}
        style={{
          textAlign: 'center',
          padding: '24px 12px',
          animation: 'slideFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Animated Feature Icon Container */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '2px solid #ccfbf1',
          borderRadius: '32px',
          width: '128px',
          height: '128px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '28px',
          boxShadow: '0 12px 32px rgba(15, 118, 110, 0.15)',
          transition: 'transform 0.3s ease'
        }}>
          {activeSlide.icon}
        </div>

        {/* Feature Title */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: 800,
          color: '#0f766e',
          marginBottom: '12px',
          lineHeight: 1.3
        }}>
          {activeSlide.title}
        </h2>

        {/* Feature Description */}
        <p style={{
          fontSize: '15px',
          color: '#475569',
          lineHeight: 1.6,
          maxWidth: '380px',
          margin: '0 auto',
          fontWeight: 500
        }}>
          {activeSlide.description}
        </p>

        {/* Animated Page Indicators */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '36px'
        }}>
          {slides.map((_, idx) => {
            const isActive = currentSlide === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                style={{
                  width: isActive ? '32px' : '10px',
                  height: '10px',
                  borderRadius: '5px',
                  backgroundColor: isActive ? '#0f766e' : '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 2px 8px rgba(15, 118, 110, 0.3)' : 'none'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Next / Get Started Action Button */}
      <PrimaryButton
        onClick={handleNext}
        style={{
          fontSize: '18px',
          padding: '16px',
          borderRadius: '16px',
          boxShadow: '0 8px 20px rgba(15, 118, 110, 0.2)'
        }}
      >
        <span>{currentSlide === slides.length - 1 ? (t.getStarted || 'Get Started') : (t.next || 'Next')}</span>
        {currentSlide === slides.length - 1 ? <ArrowRight size={20} /> : <ChevronRight size={20} />}
      </PrimaryButton>
    </div>
  );
};
