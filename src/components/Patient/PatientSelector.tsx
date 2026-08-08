import React, { useState } from 'react';
import { User, Users, Plus, Check, AlertCircle, X } from 'lucide-react';
import { UserProfile, FamilyMember, GenderOption, RelationshipOption } from '../../types/user';
import { calculateAgeFromDOB, isValidDOB, getLocalTodayISO } from '../../utils/dateUtils';

interface PatientSelectorProps {
  profile: UserProfile;
  activePatientId: string;
  onSelectPatient: (id: string) => void;
  onAddFamilyMember: (member: FamilyMember) => void;
  lang: 'en' | 'te';
}

const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  'Spouse',
  'Wife',
  'Husband',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Grandfather',
  'Grandmother',
  'Grandson',
  'Granddaughter',
  'Guardian',
  'Child',
  'Other'
];

export const PatientSelector: React.FC<PatientSelectorProps> = ({
  profile,
  activePatientId,
  onSelectPatient,
  onAddFamilyMember,
  lang
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState<string>('');
  const [newMemberDOB, setNewMemberDOB] = useState('');
  const [newMemberGender, setNewMemberGender] = useState<GenderOption>('male');
  const [newMemberBloodGroup, setNewMemberBloodGroup] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberAllergies, setNewMemberAllergies] = useState('');
  const [newMemberConditions, setNewMemberConditions] = useState('');
  const [newMemberMedications, setNewMemberMedications] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setNewMemberName('');
    setNewMemberRelation('');
    setNewMemberDOB('');
    setNewMemberGender('male');
    setNewMemberBloodGroup('');
    setNewMemberPhone('');
    setNewMemberAllergies('');
    setNewMemberConditions('');
    setNewMemberMedications('');
    setErrorMsg(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newMemberName.trim()) {
      setErrorMsg(lang === 'te' ? 'పూర్తి పేరు నమోదు చేయండి' : 'Full Name is required.');
      return;
    }
    if (!newMemberRelation) {
      setErrorMsg(lang === 'te' ? 'సంబంధం ఎంచుకోండి' : 'Please select a relationship.');
      return;
    }
    if (!newMemberDOB) {
      setErrorMsg(lang === 'te' ? 'పుట్టిన తేదీని ఎంచుకోండి' : 'Date of Birth is required.');
      return;
    }
    if (!isValidDOB(newMemberDOB)) {
      setErrorMsg(lang === 'te' ? 'భవిష్యత్తు తేదీని ఎంచుకోలేరు' : 'Date of birth cannot be in the future.');
      return;
    }

    const calculatedAge = calculateAgeFromDOB(newMemberDOB);

    const memberSlug = newMemberName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const stableId = memberSlug ? `fam_${memberSlug}` : `family_${Date.now()}`;

    const newMember: FamilyMember = {
      id: stableId,
      fullName: newMemberName.trim(),
      relation: newMemberRelation,
      dob: newMemberDOB,
      age: calculatedAge,
      gender: newMemberGender,
      bloodGroup: newMemberBloodGroup.trim() || undefined,
      phone: newMemberPhone.trim() || undefined,
      knownAllergies: newMemberAllergies.trim() || undefined,
      medicalConditions: newMemberConditions.trim() || undefined,
      currentMedications: newMemberMedications.trim() || undefined
    };

    onAddFamilyMember(newMember);
    resetForm();
    setIsModalOpen(false);
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={14} color="#0f766e" />
          {lang === 'te' ? 'ఎవరికి సహాయం కావాలి?' : 'Patient Context'}
        </span>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          style={{
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            border: 'none',
            borderRadius: '12px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <Plus size={14} />
          {lang === 'te' ? 'సభ్యుడిని జోడించు' : 'Add Family'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {/* Primary User Option */}
        <button
          type="button"
          onClick={() => onSelectPatient('user_primary')}
          style={{
            backgroundColor: activePatientId === 'user_primary' ? '#0f766e' : '#f8fafc',
            color: activePatientId === 'user_primary' ? '#ffffff' : '#334155',
            border: `1.5px solid ${activePatientId === 'user_primary' ? '#0f766e' : '#cbd5e1'}`,
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}
        >
          <User size={14} />
          <span>{profile.fullName || (lang === 'te' ? 'నేను' : 'Current User')} ({lang === 'te' ? 'నాకు' : 'Myself'})</span>
          {activePatientId === 'user_primary' && <Check size={14} />}
        </button>

        {/* Family Members */}
        {profile.familyMembers.map((member) => {
          const isActive = activePatientId === member.id;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelectPatient(member.id)}
              style={{
                backgroundColor: isActive ? '#0f766e' : '#f8fafc',
                color: isActive ? '#ffffff' : '#334155',
                border: `1.5px solid ${isActive ? '#0f766e' : '#cbd5e1'}`,
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              <span>{member.fullName} ({member.relation})</span>
              {isActive && <Check size={14} />}
            </button>
          );
        })}
      </div>

      {/* Add Family Modal */}
      {isModalOpen && (
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
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '460px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f766e' }}>
                {lang === 'te' ? 'కుటుంబ సభ్యుడిని జోడించండి' : 'Add Family Member'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Full Name * */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Full Name / పేరు *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Full Name"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Relationship * */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Relationship / సంబంధం *
                </label>
                <select
                  required
                  value={newMemberRelation}
                  onChange={(e) => setNewMemberRelation(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="" disabled>-- Select Relationship --</option>
                  {RELATIONSHIP_OPTIONS.map((rel) => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
                </select>
              </div>

              {/* Date of Birth * & Calculated Age */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    required
                    value={newMemberDOB}
                    max={getLocalTodayISO()}
                    onChange={(e) => setNewMemberDOB(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Calculated Age
                  </label>
                  <div style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f766e'
                  }}>
                    {newMemberDOB ? `${calculateAgeFromDOB(newMemberDOB)} yrs` : 'Select DOB'}
                  </div>
                </div>
              </div>

              {/* Sex / Gender * */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Sex / Gender *
                </label>
                <select
                  required
                  value={newMemberGender}
                  onChange={(e) => setNewMemberGender(e.target.value as GenderOption)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              {/* Optional Healthcare Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Blood Group (Optional)
                  </label>
                  <input
                    type="text"
                    value={newMemberBloodGroup}
                    onChange={(e) => setNewMemberBloodGroup(e.target.value)}
                    placeholder="e.g. O+"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Known Allergies (Optional)
                </label>
                <input
                  type="text"
                  value={newMemberAllergies}
                  onChange={(e) => setNewMemberAllergies(e.target.value)}
                  placeholder="e.g. Dust, Penicillin"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Existing Medical Conditions (Optional)
                </label>
                <input
                  type="text"
                  value={newMemberConditions}
                  onChange={(e) => setNewMemberConditions(e.target.value)}
                  placeholder="e.g. Asthma, Hypertension"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Current Medications (Optional)
                </label>
                <input
                  type="text"
                  value={newMemberMedications}
                  onChange={(e) => setNewMemberMedications(e.target.value)}
                  placeholder="e.g. Paracetamol, Inhaler"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, minHeight: '40px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, minHeight: '40px' }}
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

