import React, { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { HealthRecord } from '../types/records';
import { fetchRecordsBackend } from '../services/api';
import { HealthRecordCard } from '../components/Records/HealthRecordCard';
import { PatientSelector } from '../components/Patient/PatientSelector';
import { EmptyState } from '../components/Common/EmptyState';

interface HealthRecordsScreenProps {
  records: HealthRecord[];
  profile: any;
  activePatientId: string;
  onSelectPatient: (id: string) => void;
  onAddFamilyMember: (member: any) => void;
  onNavigateToScan: () => void;
}

export const HealthRecordsScreen: React.FC<HealthRecordsScreenProps> = ({
  records: initialRecords,
  profile,
  activePatientId,
  onSelectPatient,
  onAddFamilyMember,
  onNavigateToScan
}) => {
  const { lang, t } = useLanguage();
  const [filterType, setFilterType] = useState<string>('all');
  const [displayRecords, setDisplayRecords] = useState<HealthRecord[]>(initialRecords);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadRecords() {
      setIsLoading(true);
      try {
        const remote = await fetchRecordsBackend(activePatientId);
        if (remote && remote.length > 0) {
          setDisplayRecords(remote);
        } else {
          setDisplayRecords(initialRecords);
        }
      } catch {
        setDisplayRecords(initialRecords);
      } finally {
        setIsLoading(false);
      }
    }
    loadRecords();
  }, [activePatientId, initialRecords]);

  const activePatientName = activePatientId === 'user_primary'
    ? profile.fullName
    : (profile.familyMembers.find((f: any) => f.id === activePatientId)?.fullName || 'Patient');

  // Filter records by patient & type
  const filteredRecords = displayRecords.filter((rec) => {
    const matchesPatient = activePatientId === 'user_primary'
      ? (rec.patientId === 'user_primary' || rec.patientName === profile.fullName)
      : (rec.patientId === activePatientId || rec.patientName === activePatientName);

    if (filterType === 'all') return matchesPatient;
    return matchesPatient && rec.type === filterType;
  });

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <FileText size={24} />
          {t.recordsTitle}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Offline-accessible timeline of triage sessions, medical documents, and clinical visits.
        </p>
      </div>

      {/* Patient Selector */}
      <PatientSelector
        profile={profile}
        activePatientId={activePatientId}
        onSelectPatient={onSelectPatient}
        onAddFamilyMember={onAddFamilyMember}
        lang={lang}
      />

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: 'All Records' },
          { id: 'triage_session', label: 'Triage Sessions' },
          { id: 'medical_document', label: 'Documents' },
          { id: 'clinical_visit', label: 'Clinic Visits' }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilterType(item.id)}
            style={{
              backgroundColor: filterType === item.id ? '#0f766e' : '#f1f5f9',
              color: filterType === item.id ? '#ffffff' : '#475569',
              border: 'none',
              borderRadius: '16px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontSize: '13px', marginBottom: '12px' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Fetching latest records from GramCare AI API...</span>
        </div>
      )}

      {/* Timeline Records List */}
      {filteredRecords.length === 0 ? (
        <EmptyState
          title="No Health Records Found"
          description={`No recorded triage sessions or documents logged for ${activePatientName}.`}
          actionLabel="Scan Document Now"
          onAction={onNavigateToScan}
        />
      ) : (
        <div className="grid-responsive-2">
          {filteredRecords.map((rec) => (
            <HealthRecordCard key={rec.id} record={rec} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
};
