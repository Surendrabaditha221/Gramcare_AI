import React from 'react';
import { Loader2 } from 'lucide-react';

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  fullWidth = true,
  style = {}
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn ${disabled || loading ? 'btn-disabled' : 'btn-primary'}`}
      style={{
        width: fullWidth ? '100%' : 'auto',
        ...style
      }}
    >
      {loading ? (
        <>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Processing...</span>
        </>
      ) : children}
    </button>
  );
};
