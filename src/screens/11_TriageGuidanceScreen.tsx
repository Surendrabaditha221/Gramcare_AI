import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, MapPin, PhoneCall, Home } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { Disclaimer } from '../components/Common/Disclaimer';
import { PrimaryButton } from '../components/Common/PrimaryButton';
import { SecondaryButton } from '../components/Common/SecondaryButton';

interface TriageGuidanceScreenProps {
  triageData: any;
  onNavigate: (route: string) => void;
  onOpenEmergency: () => void;
}

export const TriageGuidanceScreen: React.FC<TriageGuidanceScreenProps> = ({
  triageData,
  onNavigate,
  onOpenEmergency
}) => {
  const { lang, t } = useLanguage();

  const isUrgent = triageData?.isUrgent || triageData?.severity === 'Severe';
  const urgencyCategory = isUrgent
    ? 'Emergency Attention'
    : (triageData?.severity === 'Moderate' ? 'Seek Medical Care Soon' : 'Non-Urgent Guidance');

  const getUrgencyBadge = () => {
    switch (urgencyCategory) {
      case 'Emergency Attention':
        return (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '2px solid #fca5a5',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <ShieldAlert size={32} color="#dc2626" />
            <div>
              <span className="badge badge-urgent" style={{ fontSize: '13px', marginBottom: '4px' }}>
                Emergency Attention
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#991b1b' }}>
                {t.emergencyTitle || 'Immediate Medical Evaluation Recommended'}
              </h3>
            </div>
          </div>
        );
      case 'Seek Medical Care Soon':
        return (
          <div style={{
            backgroundColor: '#fffbe6',
            border: '2px solid #fcd34d',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertTriangle size={32} color="#d97706" />
            <div>
              <span className="badge badge-moderate" style={{ fontSize: '13px', marginBottom: '4px' }}>
                {t.moderate || 'Moderate Priority'}
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#92400e' }}>
                {t.findHealthcareBtn || 'Consult Medical Officer at PHC'}
              </h3>
            </div>
          </div>
        );
      case 'Non-Urgent Guidance':
      default:
        return (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '2px solid #86efac',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <CheckCircle size={32} color="#16a34a" />
            <div>
              <span className="badge badge-low" style={{ fontSize: '13px', marginBottom: '4px' }}>
                {t.mild || 'Non-Urgent Guidance'}
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#14532d' }}>
                {t.returnHomeBtn ? `${t.mild} - Supportive Home Care` : 'Supportive Home Care & Observation'}
              </h3>
            </div>
          </div>
        );
    }
  };

  return (
    <div>
      {/* Urgency Badge Banner */}
      {getUrgencyBadge()}

      {/* Reported Symptoms Card */}
      <div className="card">
        <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#64748b' }}>
          {t.reportedSymptomsTitle} — {triageData?.patientName || 'Patient'}
        </h4>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-low" style={{ fontSize: '13px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
            Complaint: {triageData?.mainComplaint || 'High Fever'}
          </span>
          <span className="badge badge-low" style={{ fontSize: '13px', backgroundColor: '#f1f5f9', color: '#334155' }}>
            Severity: {triageData?.severity || 'Moderate'}
          </span>
        </div>
      </div>

      {/* Recommended Next Actions */}
      <div className="card" style={{ backgroundColor: '#f8fafc' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', color: '#0f766e' }}>
          {t.recommendedActionTitle}
        </h3>

        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          {urgencyCategory === 'Emergency Attention' ? (
            <>
              <li style={{ marginBottom: '8px', fontSize: '15px', color: '#1e293b' }}>
                Call 108 Emergency Ambulance or transport immediately to nearest CHC/Hospital.
              </li>
              <li style={{ marginBottom: '8px', fontSize: '15px', color: '#1e293b' }}>
                Contact your local village ASHA worker or community health worker for assistance.
              </li>
              <li style={{ fontSize: '15px', color: '#1e293b' }}>
                Keep patient calm, hydrated, and do not administer unverified drugs.
              </li>
            </>
          ) : (
            <>
              <li style={{ marginBottom: '8px', fontSize: '15px', color: '#1e293b' }}>
                Visit nearest Primary Health Centre (PHC) OPD for physician consultation.
              </li>
              <li style={{ marginBottom: '8px', fontSize: '15px', color: '#1e293b' }}>
                Drink clean ORS fluids or boiled water to prevent dehydration.
              </li>
              <li style={{ fontSize: '15px', color: '#1e293b' }}>
                Monitor temperature; perform lukewarm sponging if body temperature rises.
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Safety Disclaimer */}
      <Disclaimer compact={true} />

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
        {urgencyCategory === 'Emergency Attention' ? (
          <button onClick={onOpenEmergency} className="btn btn-emergency" style={{ fontSize: '18px', padding: '16px' }}>
            <PhoneCall size={22} />
            <span>{t.emergencyHelpBtn}</span>
          </button>
        ) : (
          <PrimaryButton onClick={() => onNavigate('nearby')} style={{ fontSize: '16px', padding: '14px' }}>
            <MapPin size={20} />
            <span>{t.findHealthcareBtn}</span>
          </PrimaryButton>
        )}

        <SecondaryButton onClick={() => onNavigate('home')}>
          <Home size={18} />
          <span>{t.returnHomeBtn}</span>
        </SecondaryButton>
      </div>
    </div>
  );
};
