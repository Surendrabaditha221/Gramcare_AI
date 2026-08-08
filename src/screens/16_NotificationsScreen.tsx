import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { NotificationItem } from '../types/notification';
import { fetchAlertsBackend } from '../services/api';
import { NotificationCard } from '../components/Notifications/NotificationCard';
import { EmptyState } from '../components/Common/EmptyState';

interface NotificationsScreenProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  notifications: initialNotifs,
  onMarkAllRead
}) => {
  const { lang, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [items, setItems] = useState<NotificationItem[]>(initialNotifs);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadAlerts() {
      setIsLoading(true);
      try {
        const remote = await fetchAlertsBackend();
        if (remote && remote.length > 0) {
          setItems(remote);
        } else {
          setItems(initialNotifs);
        }
      } catch {
        setItems(initialNotifs);
      } finally {
        setIsLoading(false);
      }
    }
    loadAlerts();
  }, [initialNotifs]);

  const filteredNotifs = items.filter((n) => {
    if (activeCategory === 'all') return true;
    return n.category === activeCategory;
  });

  return (
    <div>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Bell size={24} />
            {t.notificationsTitle}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Health reminders, system alerts, and record updates.
          </p>
        </div>

        <button
          onClick={onMarkAllRead}
          style={{
            fontSize: '12px',
            color: '#0f766e',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <CheckCheck size={16} />
          {t.markAllRead}
        </button>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: 'All Alerts' },
          { id: 'health', label: 'Health Alerts' },
          { id: 'records', label: 'Records' },
          { id: 'reminders', label: 'Reminders' },
          { id: 'system', label: 'System' }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveCategory(item.id)}
            style={{
              backgroundColor: activeCategory === item.id ? '#0f766e' : '#f1f5f9',
              color: activeCategory === item.id ? '#ffffff' : '#475569',
              border: 'none',
              borderRadius: '16px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontSize: '13px', marginBottom: '12px' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Fetching latest advisories from GramCare AI API...</span>
        </div>
      )}

      {/* Notification Cards List */}
      {filteredNotifs.length === 0 ? (
        <EmptyState
          title="No Alerts Found"
          description="You are all caught up! No active notifications in this category."
          icon={<Bell size={28} color="#94a3b8" />}
        />
      ) : (
        <div>
          {filteredNotifs.map((item) => (
            <NotificationCard key={item.id} item={item} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
};
