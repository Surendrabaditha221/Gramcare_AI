import React, { useState } from 'react';
import {
  Bot,
  Stethoscope,
  ScanLine,
  Users,
  History,
  Hospital,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  BellRing
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PatientSelector } from '../components/Patient/PatientSelector';
import { FeatureCard } from '../components/Common/FeatureCard';
import { EmergencyButton } from '../components/Common/EmergencyButton';
import { OfflineBanner } from '../components/Connectivity/OfflineBanner';

interface HomeDashboardScreenProps {
  userName: string;
  isOnline: boolean;
  profile: any;
  activePatientId: string;
  onSelectPatient: (id: string) => void;
  onAddFamilyMember: (member: any) => void;
  onNavigate: (route: string) => void;
  onOpenEmergency: () => void;
}

export const HomeDashboardScreen: React.FC<HomeDashboardScreenProps> = ({
  userName,
  isOnline,
  profile,
  activePatientId,
  onSelectPatient,
  onAddFamilyMember,
  onNavigate,
  onOpenEmergency
}) => {
  const { lang, t } = useLanguage();
  const { backendStatus, checkHealthNow } = useOnlineStatus();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryBackend = async () => {
    setIsRetrying(true);
    await checkHealthNow(true);
    setIsRetrying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Patient Section */}
      <div className="grid-responsive-2" style={{ alignItems: 'center' }}>
        {/* Personalized Greeting */}
        <div>
          <h1 style={{ fontSize: '26px', color: '#0f766e', marginBottom: '4px' }}>
            {t.greeting}, {userName}! 👋
          </h1>
          <p style={{ fontSize: '15px', color: '#475569', margin: 0 }}>
            {t.howCanHelp}
          </p>
        </div>

        {/* High-Visibility SOS Button */}
        <div>
          <EmergencyButton
            label={t.sosBtn}
            onClick={onOpenEmergency}
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PROMINENT ONE-TAP EMERGENCY SOS CARD                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
          border: '2px solid #f87171',
          borderRadius: '20px',
          padding: '20px',
          margin: 0,
          boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              marginBottom: '6px'
            }}>
              <ShieldAlert size={14} color="#dc2626" />
              <span>🚨 EMERGENCY SOS</span>
            </div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#991b1b', fontWeight: 900 }}>
              Alert My Family
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: 500, lineHeight: 1.4 }}>
              Send an emergency alert to all your saved emergency contacts.
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ffffff',
            border: '1px solid #fecaca',
            padding: '6px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#7f1d1d',
            fontWeight: 600
          }}>
            <Users size={14} color="#dc2626" />
            <span>Notifies All Active Contacts</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            id="home-btn-send-emergency-alert"
            onClick={onOpenEmergency}
            className="btn btn-emergency"
            style={{
              width: '100%',
              fontSize: '18px',
              fontWeight: 800,
              padding: '16px 20px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              letterSpacing: '0.02em'
            }}
          >
            <BellRing size={22} />
            <span>🚨 SEND EMERGENCY ALERT</span>
          </button>
        </div>
      </div>

      {/* Patient Selector */}
      <PatientSelector
        profile={profile}
        activePatientId={activePatientId}
        onSelectPatient={onSelectPatient}
        onAddFamilyMember={onAddFamilyMember}
        lang={lang}
      />

      {/* Real-time Offline Status Banner */}
      {!isOnline && (
        <OfflineBanner
          onGoToFirstAid={() => onNavigate('firstaid')}
          onOpenEmergency={onOpenEmergency}
        />
      )}

      {/* Real-time State B Banner: Internet Online + Backend UNREACHABLE */}
      {isOnline && backendStatus === 'UNREACHABLE' && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1.5px solid #fed7aa',
          borderRadius: '16px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={22} color="#c2410c" style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#9a3412', fontWeight: 700 }}>
                {t.backendUnavailableTitle}
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#c2410c', lineHeight: 1.4 }}>
                {t.backendUnavailableSub}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryBackend}
            disabled={isRetrying}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1.5px solid #c2410c',
              backgroundColor: '#ffffff',
              color: '#c2410c',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isRetrying ? t.loading : t.retryBtn}
          </button>
        </div>
      )}

      {/* Dynamic Symptom Triage & Guidance Hero Banner */}
      <div
        className="card"
        style={{
          background: isOnline
            ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)'
            : 'linear-gradient(135deg, #334155 0%, #475569 100%)',
          color: '#ffffff',
          padding: '24px',
          borderRadius: '20px',
          margin: 0,
          boxShadow: isOnline
            ? '0 8px 24px rgba(15, 118, 110, 0.2)'
            : '0 8px 24px rgba(51, 65, 85, 0.2)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={16} color={isOnline ? '#99f6e4' : '#cbd5e1'} />
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: isOnline ? '#99f6e4' : '#cbd5e1',
              letterSpacing: '0.5px'
            }}>
              {isOnline ? 'ONLINE AI TRIAGE ACTIVE' : 'OFFLINE MODE ACTIVE'}
            </span>
          </div>

          <h2 style={{ color: '#ffffff', fontSize: '22px', marginBottom: '8px' }}>
            {t.symptomTriageHeroTitle}
          </h2>

          <p style={{ fontSize: '14px', color: isOnline ? '#ccfbf1' : '#e2e8f0', marginBottom: '20px', lineHeight: 1.5, maxWidth: '800px' }}>
            {isOnline ? t.symptomTriageHeroOnlineSub : t.symptomTriageHeroOfflineSub}
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => onNavigate(isOnline ? 'triage' : 'firstaid')}
            className="btn"
            style={{
              backgroundColor: '#ffffff',
              color: isOnline ? '#0f766e' : '#334155',
              fontSize: '15px',
              fontWeight: 700,
              borderRadius: '12px',
              padding: '12px 24px',
              width: 'auto',
              display: 'inline-flex',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {isOnline ? t.openOnlineTriage : t.openOfflineTriage}
          </button>
        </div>
      </div>

      {/* Main Feature Cards Grid (1 col mobile, 2 col tablet, 3 col desktop) */}
      <div>
        <h3 style={{ fontSize: '18px', color: '#0f766e', marginBottom: '14px', fontWeight: 700 }}>
          {t.servicesTools}
        </h3>

        <div className="grid-responsive-3">
          {/* Network Dependent: Talk to AI */}
          <FeatureCard
            title={t.actionTalk}
            description={isOnline ? 'Ask any health concern in your language' : 'Available when back online'}
            icon={<Bot size={22} />}
            onClick={() => onNavigate('assistant')}
            accentColor="#0f766e"
            badge={!isOnline ? 'Internet Required' : undefined}
            disabled={!isOnline}
          />

          {/* Symptom Triage Questionnaire */}
          <FeatureCard
            title={t.actionCheck}
            description={isOnline ? 'Interactive multi-step triage questionnaire' : 'Offline first aid guides available'}
            icon={<Stethoscope size={22} />}
            onClick={() => onNavigate(isOnline ? 'triage' : 'firstaid')}
            accentColor="#0f766e"
          />

          {/* Network Dependent: Document Scanner */}
          <FeatureCard
            title={t.actionScan}
            description={isOnline ? 'Extract key info from prescriptions & reports' : 'Available when back online'}
            icon={<ScanLine size={22} />}
            onClick={() => onNavigate('scanner')}
            accentColor="#0284c7"
            badge={!isOnline ? 'Internet Required' : undefined}
            disabled={!isOnline}
          />

          {/* Offline Safe: Family Profiles */}
          <FeatureCard
            title={t.actionFamily}
            description="Manage health records for spouse & children"
            icon={<Users size={22} />}
            onClick={() => onNavigate('patient_select')}
            accentColor="#16a34a"
          />

          {/* Offline Safe: Health Records */}
          <FeatureCard
            title={t.actionHistory}
            description="View saved triage sessions & documents"
            icon={<History size={22} />}
            onClick={() => onNavigate('records')}
            accentColor="#d97706"
          />

          {/* Offline Safe: Nearby Healthcare */}
          <FeatureCard
            title={t.actionNearby}
            description="Locate nearest PHCs, CHCs & ASHA workers"
            icon={<Hospital size={22} />}
            onClick={() => onNavigate('nearby')}
            accentColor="#7c3aed"
          />
        </div>
      </div>
    </div>
  );
};
