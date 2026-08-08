import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface DisclaimerProps {
  compact?: boolean;
}

export const Disclaimer: React.FC<DisclaimerProps> = ({ compact = false }) => {
  const { t } = useLanguage();

  return (
    <div style={{
      backgroundColor: '#fefce8',
      borderLeft: '4px solid #eab308',
      borderRadius: '8px',
      padding: compact ? '10px 14px' : '14px 18px',
      marginBottom: '16px',
      fontSize: compact ? '13px' : '15px',
      color: '#713f12',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start'
    }}>
      <ShieldAlert size={compact ? 20 : 24} color="#ca8a04" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div>
        {!compact && (
          <strong style={{ display: 'block', marginBottom: '4px', color: '#854d0e' }}>
            {t.disclaimerHeader}
          </strong>
        )}
        <p style={{ margin: 0, lineHeight: 1.4 }}>
          {t.disclaimerBody}
        </p>
      </div>
    </div>
  );
};
