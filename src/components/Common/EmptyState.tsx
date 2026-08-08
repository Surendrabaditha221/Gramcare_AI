import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon
}) => {
  return (
    <div className="card text-center" style={{ padding: '36px 20px', color: '#64748b' }}>
      <div style={{
        backgroundColor: '#f1f5f9',
        borderRadius: '50%',
        width: '60px',
        height: '60px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '14px'
      }}>
        {icon || <Inbox size={28} color="#94a3b8" />}
      </div>
      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#334155' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary"
          style={{ width: 'auto', margin: '16px auto 0', padding: '10px 20px', fontSize: '14px' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
