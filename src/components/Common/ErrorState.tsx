import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something Went Wrong',
  message,
  onRetry
}) => {
  return (
    <div style={{
      backgroundColor: '#fef2f2',
      border: '1.5px solid #fca5a5',
      borderRadius: '16px',
      padding: '20px',
      margin: '16px 0',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#fee2e2',
        borderRadius: '50%',
        width: '48px',
        height: '48px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10px'
      }}>
        <AlertTriangle size={24} color="#dc2626" />
      </div>
      <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: '#991b1b' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d' }}>
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-secondary"
          style={{ width: 'auto', margin: '14px auto 0', padding: '8px 16px', fontSize: '13px' }}
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
    </div>
  );
};
