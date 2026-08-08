import React, { useState } from 'react';
import { Bot, Stethoscope, ShieldAlert, ArrowRight } from 'lucide-react';
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
      icon: <Bot size={64} color="#0f766e" />,
      title: t.slide1Title,
      sub: t.slide1Sub
    },
    {
      icon: <Stethoscope size={64} color="#0f766e" />,
      title: t.slide2Title,
      sub: t.slide2Sub
    },
    {
      icon: <ShieldAlert size={64} color="#0f766e" />,
      title: t.slide3Title,
      sub: t.slide3Sub
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', minHeight: '85vh', justifyContent: 'space-between', maxWidth: '560px', margin: '0 auto', width: '100%' }}>
      {/* Top Header Bar with Skip */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onComplete}
          style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', border: 'none', background: 'none', cursor: 'pointer' }}
        >
          {t.skip}
        </button>
      </div>

      {/* Slide Content */}
      <div style={{ textAlign: 'center', padding: '20px 10px' }}>
        <div style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '50%',
          width: '120px',
          height: '120px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: '0 8px 24px rgba(15, 118, 110, 0.12)'
        }}>
          {slides[currentSlide].icon}
        </div>

        <h2 style={{ fontSize: '24px', color: '#0f766e', marginBottom: '12px' }}>
          {slides[currentSlide].title}
        </h2>

        <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
          {slides[currentSlide].sub}
        </p>

        {/* Slide Indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '32px' }}>
          {slides.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: currentSlide === idx ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: currentSlide === idx ? '#0f766e' : '#cbd5e1',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>
      </div>

      {/* Next / Get Started Button */}
      <PrimaryButton onClick={handleNext} style={{ fontSize: '18px', padding: '16px', borderRadius: '14px' }}>
        <span>{currentSlide === slides.length - 1 ? t.getStarted : t.next}</span>
        <ArrowRight size={20} />
      </PrimaryButton>
    </div>
  );
};
