import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { TriageSeverity } from '../../types/triage';

interface SeverityBadgeProps {
  severity: TriageSeverity;
  lang?: 'en' | 'te';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, lang = 'en' }) => {
  switch (severity) {
    case 'urgent':
    case 'emergency':
      return (
        <span className="badge badge-urgent">
          <AlertCircle size={14} />
          {lang === 'te' ? 'అత్యవసరం (Urgent)' : 'Urgent Attention Required'}
        </span>
      );
    case 'moderate':
      return (
        <span className="badge badge-moderate">
          <AlertTriangle size={14} />
          {lang === 'te' ? 'మధ్యస్థ ప్రాధాన్యత' : 'Moderate Priority'}
        </span>
      );
    case 'low':
    default:
      return (
        <span className="badge badge-low">
          <CheckCircle size={14} />
          {lang === 'te' ? 'సాధారణం' : 'Mild Guidance'}
        </span>
      );
  }
};
