import React, { useState } from 'react';
import { User, Calendar, MapPin, Edit, Users, Shield, Settings, LogOut, Trash2, AlertTriangle, Stethoscope, PlusCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { UserProfile, FamilyMember } from '../types/user';
import { EditFamilyMemberModal } from '../components/Patient/EditFamilyMemberModal';
import { EditMedicalInfoModal } from '../components/Patient/EditMedicalInfoModal';
import { EditPersonalProfileModal } from '../components/Patient/EditPersonalProfileModal';
import { EmergencyContactsSection } from '../components/Emergency/EmergencyContactsSection';
import { calculateAgeFromDOB, formatDOBForDisplay } from '../utils/dateUtils';
import { isUnwantedFamilyMember } from '../services/localStorageService';

interface ProfileScreenProps {
  profile: UserProfile;
  onEditProfile?: () => void;
  onNavigateToSettings: () => void;
  onLogout?: () => void;
  onUpdateFamilyMember?: (member: FamilyMember) => void;
  onRemoveFamilyMember?: (id: string) => void;
  onUpdateProfile?: (updatedProfile: UserProfile) => Promise<void> | void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  onEditProfile,
  onNavigateToSettings,
  onLogout,
  onUpdateFamilyMember,
  onRemoveFamilyMember,
  onUpdateProfile
}) => {
  const { lang, t } = useLanguage();
  const [isEditingPersonalProfile, setIsEditingPersonalProfile] = useState<boolean>(false);
  const [profileSuccessNotice, setProfileSuccessNotice] = useState<string | null>(null);
  const [editingFamilyMember, setEditingFamilyMember] = useState<FamilyMember | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [deletingMemberName, setDeletingMemberName] = useState<string>('');
  const [isEditingMedicalInfo, setIsEditingMedicalInfo] = useState<boolean>(false);

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
      {/* Profile Success Toast Banner */}
      {profileSuccessNotice && (
        <div style={{
          backgroundColor: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #bbf7d0',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <CheckCircle2 size={18} color="#16a34a" />
          <span>{profileSuccessNotice}</span>
        </div>
      )}

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
          {profile.village ? `${profile.village}, ${profile.district}` : 'GramCare Health Passport'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsEditingPersonalProfile(true)}
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
        {/* Card 1: Personal Details */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} />
              Personal Details
            </h3>
            <button
              onClick={() => setIsEditingPersonalProfile(true)}
              style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Edit
            </button>
          </div>

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
              <span style={{ fontSize: '14px', color: '#64748b' }}>Phone Number:</span>
              <strong style={{ fontSize: '14px', color: profile.phone ? '#1e293b' : '#94a3b8' }}>
                {profile.phone || 'Not provided'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Email:</span>
              <strong style={{ fontSize: '14px', color: profile.email ? '#1e293b' : '#94a3b8' }}>
                {profile.email || 'Not provided'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Address / Village:</span>
              <strong style={{ fontSize: '14px', color: '#1e293b', textAlign: 'right', maxWidth: '60%' }}>
                {profile.address || profile.village || 'Not provided'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>District &amp; State:</span>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                {profile.district}{profile.state ? `, ${profile.state}` : ''}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>PIN Code:</span>
              <strong style={{ fontSize: '14px', color: profile.pincode ? '#1e293b' : '#94a3b8' }}>
                {profile.pincode || 'Not provided'}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 2: Dedicated Medical Information Section */}
        <div className="card" style={{ margin: 0, border: '1.5px solid #ccfbf1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Stethoscope size={20} />
              Medical Information
            </h3>

            <button
              type="button"
              onClick={() => setIsEditingMedicalInfo(true)}
              style={{
                backgroundColor: '#f0fdf4',
                color: '#0f766e',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Edit size={13} />
              Edit Medical Info
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Blood Group:</span>
              <strong style={{ fontSize: '15px', color: profile.bloodGroup ? '#b91c1c' : '#94a3b8' }}>
                {profile.bloodGroup || 'Not specified'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Emergency Contact:</span>
              <strong style={{ fontSize: '15px', color: profile.emergencyContactPhone ? '#1e293b' : '#94a3b8' }}>
                {profile.emergencyContactPhone || 'Not specified'}
              </strong>
            </div>

            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Known Allergies:</span>
              <span style={{ fontSize: '14px', color: profile.knownAllergies ? '#b91c1c' : '#94a3b8', fontWeight: profile.knownAllergies ? 600 : 400 }}>
                {profile.knownAllergies || 'None reported'}
              </span>
            </div>

            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Existing Medical Conditions:</span>
              <span style={{ fontSize: '14px', color: profile.medicalConditions ? '#1e293b' : '#94a3b8', fontWeight: profile.medicalConditions ? 600 : 400 }}>
                {profile.medicalConditions || 'None reported'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Current Medications:</span>
              <span style={{ fontSize: '14px', color: profile.currentMedications ? '#0f766e' : '#94a3b8', fontWeight: profile.currentMedications ? 600 : 400 }}>
                {profile.currentMedications || 'None reported'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Family Profiles */}
        <div className="card" style={{ margin: 0 }}>
          {(() => {
            const validFamilyMembers = (profile.familyMembers || []).filter(
              (fam) => !isUnwantedFamilyMember(fam, profile.fullName)
            );
            return (
              <>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} />
                  Family Profiles ({validFamilyMembers.length})
                </h3>

                {validFamilyMembers.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    No family members added yet. Click "+ Add Family" in Patient Context to add your relatives.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {validFamilyMembers.map((fam) => (
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
        </>
      );
    })()}
  </div>
</div>

      {/* Emergency SOS Contacts & Push Notifications Section */}
      <EmergencyContactsSection />

      {/* Edit Personal Profile Modal */}
      {isEditingPersonalProfile && (
        <EditPersonalProfileModal
          isOpen={isEditingPersonalProfile}
          profile={profile}
          onClose={() => setIsEditingPersonalProfile(false)}
          onSave={async (updated) => {
            if (onUpdateProfile) {
              await onUpdateProfile(updated);
            }
            setProfileSuccessNotice('Personal profile updated successfully!');
            setTimeout(() => setProfileSuccessNotice(null), 3500);
          }}
        />
      )}

      {/* Edit Medical Info Modal */}
      {isEditingMedicalInfo && (
        <EditMedicalInfoModal
          isOpen={isEditingMedicalInfo}
          profile={profile}
          onClose={() => setIsEditingMedicalInfo(false)}
          onSave={(updated) => {
            if (onUpdateProfile) {
              onUpdateProfile(updated);
            }
            setIsEditingMedicalInfo(false);
          }}
        />
      )}

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

