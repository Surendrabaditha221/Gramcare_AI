import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { FamilyMember, GenderOption, RelationshipOption } from '../../types/user';
import { calculateAgeFromDOB, isValidDOB, getLocalTodayISO } from '../../utils/dateUtils';

interface EditFamilyMemberModalProps {
  isOpen: boolean;
  member: FamilyMember | null;
  onClose: () => void;
  onSave: (updated: FamilyMember) => void;
  lang?: string;
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

export const EditFamilyMemberModal: React.FC<EditFamilyMemberModalProps> = ({
  isOpen,
  member,
  onClose,
  onSave,
  lang
}) => {
  const [fullName, setFullName] = useState(member?.fullName || '');
  const [relation, setRelation] = useState<string>(member?.relation || '');
  const [dob, setDob] = useState(member?.dob || '');
  const [gender, setGender] = useState<GenderOption>(member?.gender || 'male');
  const [bloodGroup, setBloodGroup] = useState(member?.bloodGroup || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [knownAllergies, setKnownAllergies] = useState(member?.knownAllergies || '');
  const [medicalConditions, setMedicalConditions] = useState(member?.medicalConditions || '');
  const [currentMedications, setCurrentMedications] = useState(member?.currentMedications || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setFullName(member.fullName || '');
      setRelation(member.relation || '');
      setDob(member.dob || '');
      setGender(member.gender || 'male');
      setBloodGroup(member.bloodGroup || '');
      setPhone(member.phone || '');
      setKnownAllergies(member.knownAllergies || '');
      setMedicalConditions(member.medicalConditions || '');
      setCurrentMedications(member.currentMedications || '');
      setErrorMsg(null);
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const calculatedAge = dob ? calculateAgeFromDOB(dob) : member.age;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg(lang === 'te' ? 'పూర్తి పేరు తప్పనిసరి' : 'Full Name is required.');
      return;
    }
    if (!relation) {
      setErrorMsg(lang === 'te' ? 'సంబంధం ఎంచుకోండి' : 'Please select a relationship.');
      return;
    }
    if (!dob) {
      setErrorMsg(lang === 'te' ? 'పుట్టిన తేదీ తప్పనిసరి' : 'Date of Birth is required.');
      return;
    }
    if (!isValidDOB(dob)) {
      setErrorMsg(lang === 'te' ? 'భవిష్యత్తు తేదీని ఎంచుకోలేరు' : 'Date of birth cannot be in the future.');
      return;
    }

    const updatedMember: FamilyMember = {
      ...member,
      fullName: fullName.trim(),
      relation,
      dob,
      age: calculatedAge,
      gender,
      bloodGroup: bloodGroup.trim() || undefined,
      phone: phone.trim() || undefined,
      knownAllergies: knownAllergies.trim() || undefined,
      medicalConditions: medicalConditions.trim() || undefined,
      currentMedications: currentMedications.trim() || undefined
    };

    onSave(updatedMember);
    onClose();
  };

  return (
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
      zIndex: 1100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '24px',
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#0f766e', fontWeight: 700 }}>
            {lang === 'te' ? 'సభ్యుడి వివరాలను సవరించండి' : 'Edit Family Profile'}
          </h3>
          <button
            type="button"
            onClick={onClose}
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
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Full Name * */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              {lang === 'te' ? 'పూర్తి పేరు' : 'Full Name'} *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Full Name"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            />
          </div>

          {/* Relationship * */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              {lang === 'te' ? 'సంబంధం (ముఖ్య వినియోగదారుతో)' : 'Relationship (to Primary User)'} *
            </label>
            <select
              required
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            >
              <option value="" disabled>-- Select Relationship --</option>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Date of Birth * & Calculated Age */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                {lang === 'te' ? 'పుట్టిన తేదీ' : 'Date of Birth'} *
              </label>
              <input
                type="date"
                required
                value={dob}
                max={getLocalTodayISO()}
                onChange={(e) => setDob(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                {lang === 'te' ? 'లెక్కింపు వయస్సు' : 'Calculated Age'}
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
                {calculatedAge} yrs
              </div>
            </div>
          </div>

          {/* Sex / Gender * */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              {lang === 'te' ? 'లింగం' : 'Sex / Gender'} *
            </label>
            <select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value as GenderOption)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          {/* Optional Blood Group & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                Blood Group (Optional)
              </label>
              <input
                type="text"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                placeholder="e.g. B+"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                Phone Number (Optional)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 00000"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Optional Health Fields */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Known Allergies (Optional)
            </label>
            <input
              type="text"
              value={knownAllergies}
              onChange={(e) => setKnownAllergies(e.target.value)}
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
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
              placeholder="e.g. Asthma, Diabetes"
              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Current Medications (Optional)
            </label>
            <input
              type="text"
              value={currentMedications}
              onChange={(e) => setCurrentMedications(e.target.value)}
              placeholder="e.g. Inhaler, Paracetamol"
              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: '40px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, minHeight: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
