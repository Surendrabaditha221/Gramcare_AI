import React from 'react';
import { Bell, Heart, FileText, Info } from 'lucide-react';
import { NotificationItem } from '../../types/notification';

interface NotificationCardProps {
  item: NotificationItem;
  lang?: string;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ item, lang }) => {
  const title = (lang === 'te' && item.teluguTitle) ? item.teluguTitle : item.title;
  const message = (lang === 'te' && item.teluguMessage) ? item.teluguMessage : item.message;

  const getIcon = () => {
    switch (item.category) {
      case 'health': return <Heart size={18} color="#0f766e" />;
      case 'records': return <FileText size={18} color="#0284c7" />;
      case 'reminders': return <Bell size={18} color="#d97706" />;
      case 'system': default: return <Info size={18} color="#64748b" />;
    }
  };

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '14px',
      backgroundColor: item.isRead ? '#ffffff' : '#f0fdf4',
      borderLeft: item.isRead ? '1px solid #e2e8f0' : '4px solid #0f766e',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getIcon()}
          <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
            {title}
          </h4>
        </div>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
          {item.timestamp}
        </span>
      </div>
      <p style={{ margin: '4px 0 0 26px', fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
        {message}
      </p>
    </div>
  );
};
