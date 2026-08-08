import React from 'react';
import { PhoneCall, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';
import { TriageGuidanceResult } from '../../types/triage';
import { SeverityBadge } from './SeverityBadge';
import { Disclaimer } from '../Common/Disclaimer';
import { useLanguage } from '../../hooks/useLanguage';

interface TriageCardProps {
  result: TriageGuidanceResult;
  onOpenEmergency: () => void;
  onGoToNearbyCare: () => void;
  onReset: () => void;
}

export const TriageCard: React.FC<TriageCardProps> = ({
  result,
  onOpenEmergency,
  onGoToNearbyCare,
  onReset
}) => {
  const { lang, t } = useLanguage();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Banner */}
      <div className="card" style={{
        borderLeft: `6px solid ${
          result.severity === 'urgent' ? '#dc2626' : (result.severity === 'moderate' ? '#d97706' : '#16a34a')
        }`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <SeverityBadge severity={result.severity} lang={lang} />
          <span style={{ fontSize: '12px', color: '#64748b' }}>{result.timestamp}</span>
        </div>

        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>
          {(lang === 'te' && result.teluguTitle) ? result.teluguTitle : result.title}
        </h2>

        <p style={{ fontSize: '15px', color: '#334155', marginBottom: '16px' }}>
          {(lang === 'te' && result.teluguSummary) ? result.teluguSummary : result.summary}
        </p>

        {/* Red Flag Warning Box */}
        {result.redFlagWarning && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertTriangle size={24} color="#dc2626" />
            <div>
              <strong style={{ color: '#991b1b', fontSize: '14px', display: 'block' }}>
                {lang === 'te' ? 'అత్యవసర హెచ్చరిక (Red Flag Warning)' : 'Urgent Warning Detected'}
              </strong>
              <span style={{ fontSize: '13px', color: '#7f1d1d' }}>
                {lang === 'te' ? 'ఆలస్యం చేయవద్దు. వెంటనే ఆసుపత్రికి వెళ్ళండి లేదా 108 కు కాల్ చేయండి.' : 'Do not delay transport. Immediate hospital evaluation needed.'}
              </span>
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f766e', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} />
            {t.recommendedActionTitle}
          </h4>

          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {((lang === 'te' && result.teluguRecommendedNextActions) ? result.teluguRecommendedNextActions : result.recommendedNextActions).map((action, idx) => (
              <li key={idx} style={{ fontSize: '15px', marginBottom: '6px', color: '#1e293b' }}>
                {action}
              </li>
            ))}
          </ul>
        </div>

        {/* Mandatory Safety Disclaimer */}
        <Disclaimer compact={true} />

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
          {result.severity === 'urgent' ? (
            <button onClick={onOpenEmergency} className="btn btn-emergency">
              <PhoneCall size={20} />
              {t.callAmbulance}
            </button>
          ) : (
            <button onClick={onGoToNearbyCare} className="btn btn-primary">
              <MapPin size={20} />
              {t.findHealthcareBtn}
            </button>
          )}

          <button onClick={onReset} className="btn btn-outline">
            {lang === 'te' ? 'కొత్త తనిఖీ ప్రారంభించండి' : 'Check Another Symptom'}
          </button>
        </div>
      </div>
    </div>
  );
};
