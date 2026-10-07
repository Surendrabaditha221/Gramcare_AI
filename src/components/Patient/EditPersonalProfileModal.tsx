import React, { useState, useEffect, useRef } from 'react';
import { User, X, Save, AlertCircle, Calendar, Phone, Mail, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { UserProfile, GenderOption, MaritalStatusOption } from '../../types/user';
import { calculateAgeFromDOB, isValidDOB, getLocalTodayISO, formatDOBToCanonical } from '../../utils/dateUtils';
import { useLanguage } from '../../hooks/useLanguage';

interface EditPersonalProfileModalProps {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (updatedProfile: UserProfile) => Promise<boolean | void> | boolean | void;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export const EditPersonalProfileModal: React.FC<EditPersonalProfileModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSave
}) => {
  const { t } = useLanguage();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [dob, setDob] = useState(formatDOBToCanonical(profile.dob || ''));
  const [gender, setGender] = useState<GenderOption>(profile.gender || 'male');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatusOption>(profile.maritalStatus || 'single');
  const [phone, setPhone] = useState(profile.phone || '');
  const [email, setEmail] = useState(profile.email || '');
  const [address, setAddress] = useState(profile.address || profile.village || '');
  const [district, setDistrict] = useState(profile.district || '');
  const [state, setState] = useState(profile.state || 'Andhra Pradesh');
  const [pincode, setPincode] = useState(profile.pincode || '');

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Prepopulate when modal opens or profile changes
  useEffect(() => {
    if (isOpen) {
      setFullName(profile.fullName || '');
      setDob(formatDOBToCanonical(profile.dob || ''));
      setGender(profile.gender || 'male');
      setMaritalStatus(profile.maritalStatus || 'single');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
      setAddress(profile.address || profile.village || '');
      setDistrict(profile.district || '');
      setState(profile.state || 'Andhra Pradesh');
      setPincode(profile.pincode || '');
      setErrors({});
      setGlobalError(null);

      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, profile]);

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const todayISO = getLocalTodayISO();
  const calculatedAge = dob && isValidDOB(dob) ? calculateAgeFromDOB(dob) : null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 1. Full name
    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required.';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Full Name must be at least 2 characters.';
    }

    // 2. Date of Birth
    if (!dob.trim()) {
      newErrors.dob = 'Date of Birth is required.';
    } else if (!isValidDOB(dob.trim())) {
      newErrors.dob = 'Please enter a valid date of birth (cannot be in the future).';
    }

    // 3. Gender
    if (!gender) {
      newErrors.gender = 'Please select a gender.';
    }

    // 4. Phone Number (optional, but if provided must be 10 digits)
    if (phone.trim()) {
      const cleanPhone = phone.trim().replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        newErrors.phone = 'Phone number must be a valid 10-digit number.';
      }
    }

    // 5. Email (optional, but if provided must be valid)
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }

    // 6. District (required for GramCare rural healthcare routing)
    if (!district.trim()) {
      newErrors.district = 'District is required for local healthcare routing.';
    }

    // 7. PIN Code (optional, but if provided must be 6 digits)
    if (pincode.trim()) {
      const cleanPin = pincode.trim().replace(/\D/g, '');
      if (cleanPin.length !== 6) {
        newErrors.pincode = 'PIN Code must be exactly 6 digits.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const canonicalDOB = formatDOBToCanonical(dob.trim());
      const age = calculateAgeFromDOB(canonicalDOB);

      // Build updated profile preserving ALL medical fields and identifiers
      const updated: UserProfile = {
        ...profile,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        dob: canonicalDOB,
        age: age > 0 ? age : (profile.age || 0),
        gender,
        maritalStatus,
        phone: phone.trim() || undefined,
        email: email.trim() || profile.email,
        address: address.trim() || undefined,
        village: address.trim() || profile.village || district.trim(),
        district: district.trim(),
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        profileCompleted: true,
        isProfileCompleted: true,
        isOnboardingCompleted: true,
        // Explicitly preserve medical information unchanged
        bloodGroup: profile.bloodGroup,
        emergencyContactPhone: profile.emergencyContactPhone,
        ashaWorkerPhone: profile.ashaWorkerPhone,
        knownAllergies: profile.knownAllergies,
        medicalConditions: profile.medicalConditions,
        currentMedications: profile.currentMedications,
        familyMembers: profile.familyMembers,
        updatedAt: new Date().toISOString()
      };

      const result = await onSave(updated);
      if (result === false) {
        setGlobalError('Failed to save profile changes. Please try again.');
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      onClose();
    } catch (err: any) {
      console.error('[EditPersonalProfileModal Save Error]', err);
      setGlobalError(err?.message || 'Failed to save changes. Your entered information has been preserved.');
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={!isSaving ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #cbd5e1',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #ccfbf1',
              borderRadius: '12px',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f766e',
              flexShrink: 0
            }}>
              <User size={22} />
            </div>
            <div>
              <h2 id="edit-profile-title" style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f766e' }}>
                Edit Personal Profile
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Update your personal information &amp; demographic records
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            title="Close (Esc)"
            style={{
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              color: '#64748b',
              transition: 'background-color 0.15s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Error Banner if saving fails */}
        {globalError && (
          <div style={{
            margin: '16px 24px 0',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#dc2626',
            fontSize: '13px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{globalError}</span>
          </div>
        )}

        {/* Modal Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            {/* Row 1: Full Name & Date of Birth */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Full Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                  }}
                  placeholder="Enter full name"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: errors.fullName ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.fullName && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    Date of Birth <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {calculatedAge !== null && (
                    <span className="badge badge-low" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {calculatedAge} Years Old
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  max={todayISO}
                  value={dob}
                  onChange={(e) => {
                    setDob(e.target.value);
                    if (errors.dob) setErrors(prev => ({ ...prev, dob: '' }));
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: errors.dob ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.dob && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {errors.dob}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Gender & Marital Status */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Gender <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as GenderOption)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Marital Status
                </label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value as MaritalStatusOption)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="separated">Separated</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Row 3: Phone Number & Email Address */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Phone Number
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    value={phone}
                    maxLength={15}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    placeholder="e.g. 9876543210"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '12px',
                      border: errors.phone ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                      fontSize: '14px',
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                </div>
                {errors.phone && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    placeholder="name@example.com"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '12px',
                      border: errors.email ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                      fontSize: '14px',
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                </div>
                {errors.email && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Row 4: Street / Village Address */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Address / Street / Village
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter house no., street, or village name"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <MapPin size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              </div>
            </div>

            {/* Row 5: District, State & PIN Code */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  District <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    if (errors.district) setErrors(prev => ({ ...prev, district: '' }));
                  }}
                  placeholder="e.g. Warangal"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: errors.district ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.district && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {errors.district}
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  PIN Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value);
                    if (errors.pincode) setErrors(prev => ({ ...prev, pincode: '' }));
                  }}
                  placeholder="6-digit PIN"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: errors.pincode ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.pincode && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {errors.pincode}
                  </p>
                )}
              </div>
            </div>

            {/* Note about separate medical info */}
            <div style={{
              backgroundColor: '#f0fdfa',
              border: '1px solid #ccfbf1',
              borderRadius: '12px',
              padding: '12px 14px',
              fontSize: '12px',
              color: '#0f766e',
              lineHeight: 1.5
            }}>
              <strong>Note:</strong> Medical details (Blood Group, Allergies, Conditions, Medications) and Emergency Contacts are managed separately under &ldquo;Edit Medical Info&rdquo; and remain intact when updating personal details.
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: '#f8fafc',
            flexShrink: 0
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#475569',
                borderRadius: '12px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer'
              }}
            >
              {t.cancelBtn || 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              style={{
                backgroundColor: '#0f766e',
                border: 'none',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(15, 118, 110, 0.25)',
                opacity: isSaving ? 0.8 : 1
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
