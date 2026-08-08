import React, { useState } from 'react';
import { User, Calendar, MapPin, Edit, Users, Shield, Settings, LogOut, Trash2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { UserProfile, FamilyMember } from '../types/user';
import { EditFamilyMemberModal } from '../components/Patient/EditFamilyMemberModal';
import { calculateAgeFromDOB, formatDOBForDisplay } from '../utils/dateUtils';

interface ProfileScreenProps {
  profile: UserProfile;
  onEditProfile: () => void;
  onNavigateToSettings: () => void;
  onLogout?: () => void;
  onUpdateFamilyMember?: (member: FamilyMember) => void;
  onRemoveFamilyMember?: (id: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  onEditProfile,
  onNavigateToSettings,
  onLogout,
  onUpdateFamilyMember,
  onRemoveFamilyMember
}) => {
  const { lang, t } = useLanguage();
  const [editingFamilyMember, setEditingFamilyMember] = useState<FamilyMember | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [deletingMemberName, setDeletingMemberName] = useState<string>('');

  const confirmDeleteFamilyMember = (member: FamilyMember) => {
    setDeletingMemberId(member.id);
    setDeletingMemberName(member.fullName);
  };

  const handleExecuteDelete = () => {
    if (deletingMemberId && onRemoveFamilyMember) {
      onRemoveFamilyMember(deletingMemberId);
    }
    setDeletingMemberId(null);
    setDeletingMemberName('');
  };

  const derivedAge = profile.dob ? calculateAgeFromDOB(profile.dob) : null;

  return (
    <div>
      {/* Top Header Card */}
      <div className="card text-center" style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
        color: '#ffffff',
        padding: '24px',
        borderRadius: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          color: '#0f766e',
          borderRadius: '50%',
          width: '80px',
          height: '80px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
          boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
          fontSize: '32px',
          fontWeight: 800
        }}>
          {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
        </div>

        <h2 style={{ color: '#ffffff', fontSize: '22px', margin: '0 0 4px 0' }}>
          {profile.fullName} (Myself)
        </h2>

        <p style={{ color: '#ccfbf1', fontSize: '14px', margin: '0 0 16px 0' }}>
          {profile.village}, {profile.district} • GramCare Health Passport
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={onEditProfile}
            style={{
              backgroundColor: '#ffffff',
              color: '#0f766e',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Edit size={14} />
            {t.editProfile}
          </button>

          <button
            onClick={onNavigateToSettings}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Settings size={14} />
            {t.settingsTitle}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.85)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <LogOut size={14} />
              {t.logout}
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid-responsive-2">
        {/* Primary User Details */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#0f766e' }}>
            Primary Personal & Health Profile
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Full Name:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>{profile.fullName}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Date of Birth:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>{profile.dob ? formatDOBForDisplay(profile.dob) : 'N/A'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Calculated Age:</span>
              <span className="badge badge-low" style={{ fontSize: '14px', fontWeight: 700 }}>
                {derivedAge !== null && derivedAge > 0 ? `${derivedAge} Years Old` : 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Sex / Gender:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b', textTransform: 'capitalize' }}>
                {profile.gender ? profile.gender.replace('_', ' ') : 'N/A'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Marital Status:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b', textTransform: 'capitalize' }}>
                {profile.maritalStatus ? profile.maritalStatus.replace('_', ' ') : 'N/A'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Blood Group:</span>
              <strong style={{ fontSize: '15px', color: '#b91c1c' }}>{profile.bloodGroup || 'N/A'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Emergency Contact:</span>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>{profile.emergencyContactPhone || 'N/A'}</strong>
            </div>

            {profile.knownAllergies && (
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', display: 'block' }}>Known Allergies:</span>
                <span style={{ fontSize: '14px', color: '#b91c1c', fontWeight: 600 }}>{profile.knownAllergies}</span>
              </div>
            )}

            {profile.medicalConditions && (
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', display: 'block' }}>Medical Conditions:</span>
                <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>{profile.medicalConditions}</span>
              </div>
            )}

            {profile.currentMedications && (
              <div>
                <span style={{ fontSize: '13px', color: '#64748b', display: 'block' }}>Current Medications:</span>
                <span style={{ fontSize: '14px', color: '#0f766e', fontWeight: 600 }}>{profile.currentMedications}</span>
              </div>
            )}
          </div>
        </div>

        {/* Family Profiles Card */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} />
            Family Profiles ({profile.familyMembers.length})
          </h3>

          {profile.familyMembers.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              No family members added yet. Click "+ Add Family" in Patient Context to add your relatives.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {profile.familyMembers.map((fam) => (
                <div key={fam.id} style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                      {fam.fullName} ({fam.relation})
                    </h4>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      DOB: {fam.dob ? formatDOBForDisplay(fam.dob) : 'N/A'} • {fam.age} yrs • {fam.gender}
                    </span>
                    {(fam.knownAllergies || fam.medicalConditions || fam.currentMedications) && (
                      <div style={{ fontSize: '11px', color: '#0f766e', marginTop: '2px' }}>
                        {fam.knownAllergies && `Allergies: ${fam.knownAllergies} `}
                        {fam.medicalConditions && `• Conditions: ${fam.medicalConditions} `}
                        {fam.currentMedications && `• Meds: ${fam.currentMedications}`}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingFamilyMember(fam)}
                      title="Edit Family Member"
                      style={{
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDeleteFamilyMember(fam)}
                      title="Remove Family Member"
                      style={{
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Family Member Modal */}
      {editingFamilyMember && (
        <EditFamilyMemberModal
          isOpen={!!editingFamilyMember}
          member={editingFamilyMember}
          onClose={() => setEditingFamilyMember(null)}
          onSave={(updated) => {
            if (onUpdateFamilyMember) {
              onUpdateFamilyMember(updated);
            }
            setEditingFamilyMember(null);
          }}
          lang={lang}
        />
      )}

      {/* Safe Remove Confirmation Modal */}
      {deletingMemberId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1150,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <AlertTriangle size={24} />
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1e293b' }}>
              Remove Family Member
            </h3>

            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0' }}>
              Are you sure you want to remove <strong>{deletingMemberName}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingMemberId(null)}
                className="btn btn-secondary"
                style={{ flex: 1, minHeight: '40px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="btn btn-emergency"
                style={{ flex: 1, minHeight: '40px' }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

