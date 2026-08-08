import React from 'react';
import { HeartPulse, Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading GramCare AI...' }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '300px',
      padding: '40px 20px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#f0fdf4',
        borderRadius: '50%',
        padding: '20px',
        marginBottom: '16px',
        boxShadow: '0 0 20px rgba(15, 118, 110, 0.15)'
      }}>
        <HeartPulse size={48} color="#0f766e" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontWeight: 600 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span>{message}</span>
      </div>
    </div>
  );
};
