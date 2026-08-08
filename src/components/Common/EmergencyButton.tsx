import React from 'react';
import { PhoneCall } from 'lucide-react';

interface EmergencyButtonProps {
  label: string;
  onClick: () => void;
  pulse?: boolean;
}

export const EmergencyButton: React.FC<EmergencyButtonProps> = ({
  label,
  onClick,
  pulse = true
}) => {
  return (
    <button
      onClick={onClick}
      className="btn btn-emergency"
      style={{
        fontSize: '18px',
        padding: '16px',
        borderRadius: '16px',
        gap: '10px',
        boxShadow: pulse ? '0 0 16px rgba(220, 38, 38, 0.4)' : 'none'
      }}
    >
      <PhoneCall size={24} />
      <span>{label}</span>
    </button>
  );
};
