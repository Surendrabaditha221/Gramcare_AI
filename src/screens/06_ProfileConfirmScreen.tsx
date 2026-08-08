import React from 'react';
import { ShieldCheck, Edit, Check } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { UserProfile } from '../types/user';
import { formatDOBForDisplay } from '../utils/dateUtils';
import { PrimaryButton } from '../components/Common/PrimaryButton';
import { SecondaryButton } from '../components/Common/SecondaryButton';

interface ProfileConfirmScreenProps {
  profile: UserProfile;
  onEdit: () => void;
  onConfirm: () => void;
}

export const ProfileConfirmScreen: React.FC<ProfileConfirmScreenProps> = ({
  profile,
  onEdit,
  onConfirm
}) => {
  const { t } = useLanguage();

  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', minHeight: '85vh', justifyContent: 'space-between', maxWidth: '580px', margin: '0 auto', width: '100%' }}>
      <div>
        <div style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '50%',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <ShieldCheck size={36} color="#0f766e" />
        </div>

        <h2 style={{ fontSize: '24px', color: '#0f766e', marginBottom: '6px' }}>
          {t.confirmTitle}
        </h2>

        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
          {t.confirmSub}
        </p>

        {/* Profile Summary Card */}
        <div className="card" style={{ border: '2px solid #0f766e', backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Full Name:</span>
              <strong style={{ fontSize: '16px', color: '#1e293b' }}>{profile.fullName}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Date of Birth:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>{formatDOBForDisplay(profile.dob)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Calculated Age:</span>
              <span className="badge badge-low" style={{ fontSize: '14px', fontWeight: 700 }}>
                {profile.age} Years Old
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Gender:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b', textTransform: 'capitalize' }}>{profile.gender}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Location:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>{profile.village}, {profile.district}</strong>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <PrimaryButton onClick={onConfirm} style={{ fontSize: '18px', padding: '16px', borderRadius: '14px' }}>
          <Check size={20} />
          <span>{t.confirmBtn}</span>
        </PrimaryButton>

        <SecondaryButton onClick={onEdit} style={{ fontSize: '15px' }}>
          <Edit size={18} />
          <span>{t.editBtn}</span>
        </SecondaryButton>
      </div>
    </div>
  );
};
