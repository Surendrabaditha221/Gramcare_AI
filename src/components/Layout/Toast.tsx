import React, { useEffect } from 'react';
import { Wifi, X } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  durationMs?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  isVisible,
  onClose,
  durationMs = 4000
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [isVisible, durationMs, onClose]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#166534',
      color: '#ffffff',
      padding: '10px 18px',
      borderRadius: '24px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: 1000,
      fontSize: '14px',
      fontWeight: 600,
      animation: 'slideDown 0.3s ease'
    }}>
      <Wifi size={18} color="#86efac" />
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          border: 'none',
          background: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          padding: '2px'
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
