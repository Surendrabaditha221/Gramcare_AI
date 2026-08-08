import React from 'react';
import { ChevronRight, Lock } from 'lucide-react';

interface FeatureCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  accentColor?: string;
  badge?: string;
  disabled?: boolean;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  onClick,
  accentColor = '#0f766e',
  badge,
  disabled = false
}) => {
  const handleClick = () => {
    if (disabled) return;
    onClick();
  };

  return (
    <div
      className={`card ${disabled ? '' : 'card-interactive'}`}
      onClick={handleClick}
      style={{
        margin: 0,
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: `4px solid ${disabled ? '#cbd5e1' : accentColor}`,
        backgroundColor: disabled ? '#f8fafc' : '#ffffff',
        opacity: disabled ? 0.75 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          backgroundColor: disabled ? '#e2e8f0' : `${accentColor}15`,
          color: disabled ? '#64748b' : accentColor,
          borderRadius: '12px',
          padding: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: disabled ? '#64748b' : '#1e293b' }}>
              {title}
            </h3>
            {badge && (
              <span className={`badge ${disabled ? 'badge-urgent' : 'badge-low'}`} style={{ fontSize: '11px', backgroundColor: disabled ? '#ffedd5' : undefined, color: disabled ? '#c2410c' : undefined, border: disabled ? '1px solid #fed7aa' : undefined }}>
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: disabled ? '#94a3b8' : '#64748b' }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {disabled ? <Lock size={18} color="#94a3b8" /> : <ChevronRight size={20} color="#94a3b8" />}
    </div>
  );
};
