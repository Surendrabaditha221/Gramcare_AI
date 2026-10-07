import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { TriageSeverity } from '../../types/triage';
import { useLanguage } from '../../hooks/useLanguage';

interface SeverityBadgeProps {
  severity: TriageSeverity;
  lang?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const { t } = useLanguage();

  switch (severity) {
    case 'urgent':
    case 'emergency':
      return (
        <span className="badge badge-urgent">
          <AlertCircle size={14} />
          {t.severe || 'Urgent Attention Required'}
        </span>
      );
    case 'moderate':
      return (
        <span className="badge badge-moderate">
          <AlertTriangle size={14} />
          {t.moderate || 'Moderate Priority'}
        </span>
      );
    case 'low':
    default:
      return (
        <span className="badge badge-low">
          <CheckCircle size={14} />
          {t.mild || 'Mild Guidance'}
        </span>
      );
  }
};
