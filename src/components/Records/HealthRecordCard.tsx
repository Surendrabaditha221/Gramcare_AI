import React from 'react';
import { FileText, Stethoscope, Hospital, Calendar, User } from 'lucide-react';
import { HealthRecord } from '../../types/records';
import { formatDateString } from '../../utils/dateUtils';

interface HealthRecordCardProps {
  record: HealthRecord;
  lang: 'en' | 'te';
}

export const HealthRecordCard: React.FC<HealthRecordCardProps> = ({ record, lang }) => {
  const getIcon = () => {
    switch (record.type) {
      case 'triage_session': return <Stethoscope size={20} color="#0f766e" />;
      case 'clinical_visit': return <Hospital size={20} color="#0284c7" />;
      case 'medical_document': default: return <FileText size={20} color="#d97706" />;
    }
  };

  const title = (lang === 'te' && record.teluguTitle) ? record.teluguTitle : record.title;
  const summary = (lang === 'te' && record.teluguSummary) ? record.teluguSummary : record.summary;

  return (
    <div className="card" style={{ margin: 0, padding: '16px', borderRadius: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '10px', display: 'flex' }}>
            {getIcon()}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
              {title}
            </h4>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <User size={12} />
              {record.patientName}
            </span>
          </div>
        </div>

        <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Calendar size={12} />
          {formatDateString(record.date)}
        </span>
      </div>

      <p style={{ margin: '8px 0', fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
        {summary}
      </p>

      {record.facilityOrDoctor && (
        <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600, marginTop: '6px' }}>
          Provider: {record.facilityOrDoctor}
        </div>
      )}

      {record.tags && record.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          {record.tags.map((tag, idx) => (
            <span key={idx} style={{
              backgroundColor: '#f1f5f9',
              color: '#475569',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
