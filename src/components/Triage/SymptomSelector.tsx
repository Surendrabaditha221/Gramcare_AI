import React, { useState } from 'react';
import {
  Thermometer,
  Wind,
  Activity,
  Heart,
  AlertTriangle,
  ShieldAlert,
  Mic,
  Check,
  Plus
} from 'lucide-react';
import { MOCK_SYMPTOM_CATEGORIES, MOCK_SYMPTOMS } from '../../data/mockSymptoms';
import { useLanguage } from '../../hooks/useLanguage';

interface SymptomSelectorProps {
  selectedSymptomIds: string[];
  onToggleSymptom: (id: string) => void;
  disabled?: boolean;
}

export const SymptomSelector: React.FC<SymptomSelectorProps> = ({
  selectedSymptomIds,
  onToggleSymptom,
  disabled = false
}) => {
  const { lang, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>('fever');
  const [isSimulatingVoice, setIsSimulatingVoice] = useState(false);

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Thermometer': return <Thermometer size={22} />;
      case 'Wind': return <Wind size={22} />;
      case 'Activity': return <Activity size={22} />;
      case 'Heart': return <Heart size={22} />;
      case 'AlertTriangle': return <AlertTriangle size={22} />;
      case 'ShieldAlert': return <ShieldAlert size={22} />;
      default: return <Activity size={22} />;
    }
  };

  const currentSymptoms = MOCK_SYMPTOMS.filter(s => s.categoryId === activeCategory);

  const handleSimulateVoice = () => {
    if (disabled) return;
    setIsSimulatingVoice(true);
    setTimeout(() => {
      if (!selectedSymptomIds.includes('fever_high')) onToggleSymptom('fever_high');
      if (!selectedSymptomIds.includes('resp_shortness')) onToggleSymptom('resp_shortness');
      setIsSimulatingVoice(false);
    }, 1500);
  };

  return (
    <div>
      {/* Voice Assistant Aid Bar */}
      <div style={{
        backgroundColor: isSimulatingVoice ? '#ecfdf5' : '#f0fdf4',
        border: '1.5px dashed #0f766e',
        borderRadius: '16px',
        padding: '14px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: disabled ? 0.6 : 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            backgroundColor: isSimulatingVoice ? '#10b981' : '#0f766e',
            color: '#ffffff',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isSimulatingVoice ? 'pulse 1s infinite' : 'none'
          }}>
            <Mic size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', color: '#0f766e' }}>
              {lang === 'te' ? 'మాట్లాడి వివరాలు చెప్పండి' : 'Speak Symptoms in your language'}
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
              {isSimulatingVoice
                ? (lang === 'te' ? 'వినబడుతోంది: జ్వరం, శ్వాస ఆడకపోవడం...' : 'Listening: "High fever and breathing problem"...')
                : (lang === 'te' ? 'మాట్లాడేందుకు మైక్ నొక్కండి' : 'Tap microphone to speak symptoms')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSimulateVoice}
          disabled={disabled || isSimulatingVoice}
          className="btn btn-secondary"
          style={{ width: 'auto', minHeight: '36px', padding: '6px 14px', fontSize: '13px' }}
        >
          {isSimulatingVoice ? (lang === 'te' ? 'వినబడుతోంది...' : 'Listening...') : (lang === 'te' ? 'మాట్లాడండి' : 'Speak')}
        </button>
      </div>

      {/* Category Tabs Scroll */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '16px'
      }}>
        {MOCK_SYMPTOM_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          const catName = (lang === 'te' && cat.teluguName) ? cat.teluguName : cat.name;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              disabled={disabled}
              style={{
                backgroundColor: isActive ? '#0f766e' : '#f1f5f9',
                color: isActive ? '#ffffff' : '#334155',
                border: 'none',
                borderRadius: '20px',
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: '14px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: disabled ? 'not-allowed' : 'pointer'
              }}
            >
              {renderIcon(cat.iconName)}
              <span>{catName}</span>
            </button>
          );
        })}
      </div>

      {/* Symptom Selection Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        {currentSymptoms.map((symptom) => {
          const isSelected = selectedSymptomIds.includes(symptom.id);
          const symptomName = (lang === 'te' && symptom.teluguName) ? symptom.teluguName : symptom.name;
          return (
            <div
              key={symptom.id}
              onClick={() => !disabled && onToggleSymptom(symptom.id)}
              style={{
                border: isSelected ? '2px solid #0f766e' : '1px solid #e2e8f0',
                backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                    {symptomName}
                  </h4>
                  {symptom.isRedFlag && (
                    <span style={{
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      {lang === 'te' ? 'తీవ్రమైనది' : 'Red Flag'}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  {symptom.description}
                </p>
              </div>

              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isSelected ? '#0f766e' : '#f1f5f9',
                color: isSelected ? '#ffffff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isSelected ? <Check size={18} /> : <Plus size={18} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
