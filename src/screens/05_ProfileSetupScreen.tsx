import React, { useState, useEffect } from 'react';
import { User, Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../context/AuthContext';
import { calculateAgeFromDOB, isValidDOB, getLocalTodayISO } from '../utils/dateUtils';
import { UserProfile, GenderOption, MaritalStatusOption } from '../types/user';
import { PrimaryButton } from '../components/Common/PrimaryButton';

interface ProfileSetupScreenProps {
  initialProfile: UserProfile;
  onNext: (updated: UserProfile) => void;
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  initialProfile,
  onNext
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [fullName, setFullName] = useState(initialProfile.fullName || user?.displayName || '');
  const [dob, setDob] = useState(initialProfile.dob || '');
  const [gender, setGender] = useState<GenderOption | ''>(initialProfile.gender || '');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatusOption | ''>(initialProfile.maritalStatus || '');
  const [bloodGroup, setBloodGroup] = useState(initialProfile.bloodGroup || '');
  const [phone, setPhone] = useState(initialProfile.phone || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialProfile.emergencyContactPhone || '');
  const [knownAllergies, setKnownAllergies] = useState(initialProfile.knownAllergies || '');
  const [medicalConditions, setMedicalConditions] = useState(initialProfile.medicalConditions || '');
  const [currentMedications, setCurrentMedications] = useState(initialProfile.currentMedications || '');
  const [heightCm, setHeightCm] = useState<number | undefined>(initialProfile.heightCm);
  const [weightKg, setWeightKg] = useState<number | undefined>(initialProfile.weightKg);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Automatically prefill full name when authenticated user becomes available
  // (only if full name has not already been typed/edited by user)
  useEffect(() => {
    if (user?.displayName && !fullName) {
      setFullName(user.displayName);
    }
  }, [user]);

  const derivedAge = dob && isValidDOB(dob) ? calculateAgeFromDOB(dob) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!dob) {
      setErrorMsg('Please select your Date of Birth.');
      return;
    }
    if (!isValidDOB(dob)) {
      setErrorMsg('Date of Birth cannot be in the future.');
      return;
    }
    if (!gender) {
      setErrorMsg('Please select your Sex / Gender.');
      return;
    }
    if (!maritalStatus) {
      setErrorMsg('Please select your Marital Status.');
      return;
    }

    setIsSubmitting(true);

    const updatedProfile: UserProfile = {
      ...initialProfile,
      fullName: fullName.trim(),
      dob,
      age: derivedAge,
      gender: gender as GenderOption,
      maritalStatus: maritalStatus as MaritalStatusOption,
      profileCompleted: true,
      isProfileCompleted: true,
      isOnboardingCompleted: true
    };

    onNext(updatedProfile);
  };

  return (
    <div style={{ padding: '20px 16px', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
            Personal Information
          </span>
        </div>
        <h2 style={{ fontSize: '24px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
          <User size={26} />
          Create Your Health Profile
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' }}>
          Essential details for personalized healthcare guidance.
        </p>
      </div>

      {errorMsg && (
        <div style={{
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fca5a5',
          padding: '12px',
          borderRadius: '10px',
          fontSize: '14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Full Name */}
        <div className="card" style={{ margin: 0 }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
            Full Name *
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Full Name"
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '16px' }}
          />
        </div>

        {/* Date of Birth & Derived Age */}
        <div className="card" style={{ margin: 0 }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
            Date of Birth *
          </label>
          <input
            type="date"
            required
            value={dob}
            max={getLocalTodayISO()}
            onChange={(e) => setDob(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '16px', marginBottom: '10px' }}
          />

          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
            fontWeight: 600,
            color: '#15803d'
          }}>
            <span>Calculated Age:</span>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>{derivedAge > 0 ? `${derivedAge} Years` : 'Select DOB'}</span>
          </div>
        </div>

        {/* Gender Selection */}
        <div className="card" style={{ margin: 0 }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
            Sex / Gender *
          </label>
          <select
            required
            value={gender}
            onChange={(e) => setGender(e.target.value as GenderOption)}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '15px' }}
          >
            <option value="" disabled>Select Sex / Gender...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / Prefer to self-describe</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>

        {/* Marital Status */}
        <div className="card" style={{ margin: 0 }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
            Marital Status *
          </label>
          <select
            required
            value={maritalStatus}
            onChange={(e) => setMaritalStatus(e.target.value as MaritalStatusOption)}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '15px' }}
          >
            <option value="" disabled>Select Marital Status...</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="widowed">Widowed</option>
            <option value="divorced">Divorced</option>
            <option value="separated">Separated</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>

        <PrimaryButton
          type="submit"
          disabled={isSubmitting}
          style={{ fontSize: '18px', padding: '16px', borderRadius: '14px', marginTop: '10px', opacity: isSubmitting ? 0.7 : 1 }}
        >
          <span>{isSubmitting ? 'Creating Profile...' : 'Create My Profile'}</span>
          <ArrowRight size={20} />
        </PrimaryButton>
      </form>
    </div>
  );
};

