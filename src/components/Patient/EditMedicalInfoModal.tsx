import React, { useState } from 'react';
import { Stethoscope, X, Save, AlertCircle } from 'lucide-react';
import { UserProfile } from '../../types/user';
import { PrimaryButton } from '../Common/PrimaryButton';

interface EditMedicalInfoModalProps {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (updatedProfile: UserProfile) => void;
}

export const EditMedicalInfoModal: React.FC<EditMedicalInfoModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSave
}) => {
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(profile.emergencyContactPhone || '');
  const [knownAllergies, setKnownAllergies] = useState(profile.knownAllergies || '');
  const [medicalConditions, setMedicalConditions] = useState(profile.medicalConditions || '');
  const [currentMedications, setCurrentMedications] = useState(profile.currentMedications || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated: UserProfile = {
      ...profile,
      bloodGroup: bloodGroup.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      knownAllergies: knownAllergies.trim() || undefined,
      medicalConditions: medicalConditions.trim() || undefined,
      currentMedications: currentMedications.trim() || undefined
    };

    onSave(updated);
    setIsSaving(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        maxWidth: '520px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        border: '1px solid #cbd5e1'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              padding: '8px',
              color: '#0f766e',
              display: 'flex'
            }}>
              <Stethoscope size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f766e', fontWeight: 800 }}>
                Edit Medical Information
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Add or update optional health and medical details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Blood Group */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Blood Group
              </label>
              <input
                type="text"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                placeholder="e.g. O+, A+, B-"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Emergency Contact Phone */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Emergency Contact
              </label>
              <input
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+91 98765 00000"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Known Allergies */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Known Allergies
            </label>
            <input
              type="text"
              value={knownAllergies}
              onChange={(e) => setKnownAllergies(e.target.value)}
              placeholder="e.g. Dust allergy, Penicillin, Peanuts"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Existing Medical Conditions */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Existing Medical Conditions
            </label>
            <input
              type="text"
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
              placeholder="e.g. Asthma, Diabetes, Hypertension"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Current Medications */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Current Medications
            </label>
            <input
              type="text"
              value={currentMedications}
              onChange={(e) => setCurrentMedications(e.target.value)}
              placeholder="e.g. Paracetamol 500mg, Inhaler"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: '44px' }}
            >
              Cancel
            </button>

            <PrimaryButton
              type="submit"
              disabled={isSaving}
              style={{ flex: 1, minHeight: '44px', borderRadius: '12px' }}
            >
              <Save size={18} />
              <span>{isSaving ? 'Saving...' : 'Save Medical Info'}</span>
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
