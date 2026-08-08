import React, { useState } from 'react';
import { Stethoscope, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { SymptomSelector } from '../components/Triage/SymptomSelector';
import { ProgressIndicator } from '../components/Common/ProgressIndicator';
import { PrimaryButton } from '../components/Common/PrimaryButton';
import { SecondaryButton } from '../components/Common/SecondaryButton';
import { Disclaimer } from '../components/Common/Disclaimer';

interface SymptomTriageScreenProps {
  isOnline: boolean;
  activePatientName: string;
  onCompleteTriage: (resultData: any) => void;
  onOpenEmergency: () => void;
}

export const SymptomTriageScreen: React.FC<SymptomTriageScreenProps> = ({
  isOnline,
  activePatientName,
  onCompleteTriage,
  onOpenEmergency
}) => {
  const { lang, t } = useLanguage();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Triage state
  const [mainComplaint, setMainComplaint] = useState('Fever & Body Ache');
  const [duration, setDuration] = useState<'today' | 'few_days' | 'week_plus'>('today');
  const [severity, setSeverity] = useState<'Mild' | 'Moderate' | 'Severe'>('Moderate');
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<string[]>(['fever_high']);
  const [hasBreathingIssue, setHasBreathingIssue] = useState<'Yes' | 'No' | 'Not Sure'>('No');
  const [hasStiffNeck, setHasStiffNeck] = useState<'Yes' | 'No' | 'Not Sure'>('No');

  const toggleSymptom = (id: string) => {
    setSelectedSymptomIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Evaluate Triage Result
      const isUrgent = severity === 'Severe' || hasBreathingIssue === 'Yes' || hasStiffNeck === 'Yes';
      const resultData = {
        patientName: activePatientName,
        severity,
        isUrgent,
        selectedSymptomIds,
        mainComplaint,
        hasBreathingIssue
      };
      onCompleteTriage(resultData);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div>
      {/* Title Header */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '20px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Stethoscope size={24} />
          {t.triageTitle}
        </h2>
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          Assisting: <strong>{activePatientName}</strong>
        </span>
      </div>

      <Disclaimer compact={true} />

      {/* Step Progress Bar */}
      <ProgressIndicator
        currentStep={step}
        totalSteps={totalSteps}
        stepLabels={['Complaint', 'Severity', 'Symptoms', 'Warning Signs']}
      />

      {/* Stage 1: Main Complaint & Duration */}
      {step === 1 && (
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#1e293b' }}>
            1. Main Health Complaint
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
              What is the primary concern?
            </label>
            <select
              value={mainComplaint}
              onChange={(e) => setMainComplaint(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '15px' }}
            >
              <option value="Fever & Body Ache">High Fever & Body Ache / జ్వరం</option>
              <option value="Cough & Cold">Cough, Cold & Sore Throat / దగ్గు</option>
              <option value="Stomach Pain & Diarrhea">Stomach Pain & Vomiting / కడుపునొప్పి</option>
              <option value="Pregnancy Concern">Pregnancy / Maternal Concern</option>
              <option value="Injury & Bite">Injury, Cut or Snake Bite</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
              How long have symptoms lasted?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { id: 'today', label: 'Started Today' },
                { id: 'few_days', label: '2-3 Days' },
                { id: 'week_plus', label: '> 1 Week' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDuration(item.id as any)}
                  style={{
                    backgroundColor: duration === item.id ? '#0f766e' : '#f8fafc',
                    color: duration === item.id ? '#ffffff' : '#334155',
                    border: `1.5px solid ${duration === item.id ? '#0f766e' : '#cbd5e1'}`,
                    borderRadius: '10px',
                    padding: '10px 4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: Severity (Mild, Moderate, Severe) */}
      {step === 2 && (
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#1e293b' }}>
            2. Symptom Severity Level
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { id: 'Mild', label: 'Mild (हल्का / తేలికపాటి)', desc: 'Able to carry out daily work, slight discomfort' },
              { id: 'Moderate', label: 'Moderate (मध्यम / మధ్యస్థం)', desc: 'Requires rest, noticeable weakness or fever' },
              { id: 'Severe', label: 'Severe (गंभीर / తీవ్రమైన)', desc: 'Unable to stand, high fever or intense pain' }
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => setSeverity(item.id as any)}
                style={{
                  border: severity === item.id ? '2px solid #0f766e' : '1px solid #cbd5e1',
                  backgroundColor: severity === item.id ? '#f0fdf4' : '#ffffff',
                  borderRadius: '14px',
                  padding: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{item.label}</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>{item.desc}</p>
                </div>
                {severity === item.id && <CheckCircle2 size={20} color="#0f766e" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage 3: Related Symptoms Selection */}
      {step === 3 && (
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#1e293b' }}>
            3. Select Related Symptoms
          </h3>

          <SymptomSelector
            selectedSymptomIds={selectedSymptomIds}
            onToggleSymptom={toggleSymptom}
            disabled={!isOnline}
          />
        </div>
      )}

      {/* Stage 4: Relevant Warning Signs */}
      {step === 4 && (
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#dc2626' }}>
            4. Critical Warning Signs Check
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
              Is there any difficulty breathing or chest tightness?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {['Yes', 'No', 'Not Sure'].map((ans) => (
                <button
                  key={ans}
                  type="button"
                  onClick={() => setHasBreathingIssue(ans as any)}
                  style={{
                    backgroundColor: hasBreathingIssue === ans ? '#0f766e' : '#f8fafc',
                    color: hasBreathingIssue === ans ? '#ffffff' : '#334155',
                    border: `1.5px solid ${hasBreathingIssue === ans ? '#0f766e' : '#cbd5e1'}`,
                    borderRadius: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {ans}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
              Is there severe neck stiffness or loss of consciousness?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {['Yes', 'No', 'Not Sure'].map((ans) => (
                <button
                  key={ans}
                  type="button"
                  onClick={() => setHasStiffNeck(ans as any)}
                  style={{
                    backgroundColor: hasStiffNeck === ans ? '#0f766e' : '#f8fafc',
                    color: hasStiffNeck === ans ? '#ffffff' : '#334155',
                    border: `1.5px solid ${hasStiffNeck === ans ? '#0f766e' : '#cbd5e1'}`,
                    borderRadius: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {ans}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        {step > 1 && (
          <SecondaryButton onClick={handleBack} style={{ flex: 1 }}>
            <ArrowLeft size={18} />
            <span>{t.backBtn}</span>
          </SecondaryButton>
        )}

        <PrimaryButton onClick={handleNext} style={{ flex: 2 }}>
          <span>{step === totalSteps ? 'Get Triage Result' : t.continueBtn}</span>
          <ArrowRight size={18} />
        </PrimaryButton>
      </div>
    </div>
  );
};
