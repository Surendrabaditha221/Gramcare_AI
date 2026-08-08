import React from 'react';
import { Users, User, Plus, Check } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { UserProfile, FamilyMember } from '../types/user';
import { PatientSelector } from '../components/Patient/PatientSelector';
import { PrimaryButton } from '../components/Common/PrimaryButton';

interface SelectPatientScreenProps {
  profile: UserProfile;
  activePatientId: string;
  onSelectPatient: (id: string) => void;
  onAddFamilyMember: (member: FamilyMember) => void;
  onContinue: () => void;
}

export const SelectPatientScreen: React.FC<SelectPatientScreenProps> = ({
  profile,
  activePatientId,
  onSelectPatient,
  onAddFamilyMember,
  onContinue
}) => {
  const { lang, t } = useLanguage();

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={24} />
          {t.whoNeedsHelp}
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' }}>
          Select who will be using the assistant, symptom triage, or record scanner.
        </p>
      </div>

      <PatientSelector
        profile={profile}
        activePatientId={activePatientId}
        onSelectPatient={onSelectPatient}
        onAddFamilyMember={onAddFamilyMember}
        lang={lang}
      />

      <div style={{ marginTop: '24px' }}>
        <PrimaryButton onClick={onContinue} style={{ fontSize: '18px', padding: '16px', borderRadius: '14px' }}>
          <Check size={20} />
          <span>{t.continueBtn} with Selected Patient</span>
        </PrimaryButton>
      </div>
    </div>
  );
};
