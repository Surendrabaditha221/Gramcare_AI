import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  PhoneCall,
  MapPin,
  CheckCircle2,
  Clock,
  User,
  Users,
  AlertTriangle,
  ArrowLeft,
  Navigation,
  RefreshCw,
  Check,
  Send,
  HeartHandshake,
  Eye,
  CheckCheck,
  X
} from 'lucide-react';
import {
  getEmergencyAlert,
  acknowledgeEmergencyAlert,
  updateEmergencyStatus,
  resolveEmergencyAlert,
  markAlertOpenedBackend
} from '../services/api';
import { EmergencyEvent, EmergencyStatus } from '../types/emergency';
import { useLanguage } from '../hooks/useLanguage';

interface FamilyEmergencyAlertScreenProps {
  eventId: string;
  onBack: () => void;
}

export const FamilyEmergencyAlertScreen: React.FC<FamilyEmergencyAlertScreenProps> = ({
  eventId,
  onBack
}) => {
  const { lang } = useLanguage();

  const [emergencyEvent, setEmergencyEvent] = useState<EmergencyEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Acknowledge Form State
  const [showAckModal, setShowAckModal] = useState<boolean>(false);
  const [ackName, setAckName] = useState<string>('');
  const [ackPhone, setAckPhone] = useState<string>('');
  const [ackRelation, setAckRelation] = useState<string>('Family Member');
  const [ackMessage, setAckMessage] = useState<string>('');
  const [ackSubmitting, setAckSubmitting] = useState<boolean>(false);

  // Resolve Form State
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [resolverName, setResolverName] = useState<string>('');
  const [resolveNotes, setResolveNotes] = useState<string>('');
  const [resolveSubmitting, setResolveSubmitting] = useState<boolean>(false);

  const loadAlertData = async (isBackground: boolean = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await getEmergencyAlert(eventId);
      setEmergencyEvent(data);
      setErrorMessage(null);

      // Record that recipient opened this emergency alert
      if (!isBackground) {
        markAlertOpenedBackend(eventId, 'family_screen').catch(() => {});
      }
    } catch (err: any) {
      console.error('[FamilyEmergencyAlert] Error loading alert:', err);
      setErrorMessage(err?.message || 'Emergency alert could not be found or has expired.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlertData();

    // Auto-refresh every 5 seconds to capture real-time family acknowledgements & delivery updates
    const intervalId = setInterval(() => {
      loadAlertData(true);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [eventId]);

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackName.trim()) return;

    setAckSubmitting(true);
    setActionError(null);
    try {
      const updated = await acknowledgeEmergencyAlert(eventId, {
        responderName: ackName.trim(),
        responderPhone: ackPhone.trim() || undefined,
        responderRelation: ackRelation || 'Family Member',
        message: ackMessage.trim() || 'Alert acknowledged. Help is being coordinated.'
      });
      setEmergencyEvent(updated);
      setShowAckModal(false);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to acknowledge alert');
    } finally {
      setAckSubmitting(false);
    }
  };

  const handleSetHelpOnTheWay = async () => {
    setActionError(null);
    try {
      const updated = await updateEmergencyStatus(
        eventId,
        'Help Is on the Way',
        'Family responder confirmed help is en route'
      );
      setEmergencyEvent(updated);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update status');
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolverName.trim()) return;

    setResolveSubmitting(true);
    setActionError(null);
    try {
      const updated = await resolveEmergencyAlert(eventId, {
        resolvedBy: resolverName.trim(),
        resolutionNotes: resolveNotes.trim() || 'Emergency situation resolved safely.'
      });
      setEmergencyEvent(updated);
      setShowResolveModal(false);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to resolve alert');
    } finally {
      setResolveSubmitting(false);
    }
  };

  // Status Badge Styling Helper
  const getStatusBadge = (status: EmergencyStatus | string) => {
    switch (status) {
      case 'SOS Initiated':
      case 'Alert Processing':
      case 'Notifications Submitted':
      case 'Alert Sent':
        return {
          bg: '#fee2e2',
          text: '#b91c1c',
          border: '#fca5a5',
          label: '🚨 EMERGENCY ACTIVE'
        };
      case 'Delivered to Device':
        return {
          bg: '#fef3c7',
          text: '#b45309',
          border: '#fde68a',
          label: '📱 DELIVERED TO DEVICE'
        };
      case 'Notification Opened':
        return {
          bg: '#e0f2fe',
          text: '#0369a1',
          border: '#bae6fd',
          label: '👁️ ALERT OPENED'
        };
      case 'Family Acknowledged':
        return {
          bg: '#fef3c7',
          text: '#b45309',
          border: '#fde68a',
          label: '🤝 FAMILY ACKNOWLEDGED'
        };
      case 'Help Is on the Way':
        return {
          bg: '#e0f2fe',
          text: '#0369a1',
          border: '#bae6fd',
          label: '🚑 HELP EN ROUTE'
        };
      case 'Resolved':
        return {
          bg: '#ecfdf5',
          text: '#047857',
          border: '#a7f3d0',
          label: '✅ RESOLVED'
        };
      case 'Cancelled':
        return {
          bg: '#f1f5f9',
          text: '#475569',
          border: '#cbd5e1',
          label: 'CANCELLED'
        };
      default:
        return {
          bg: '#fee2e2',
          text: '#b91c1c',
          border: '#fca5a5',
          label: status
        };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
        <RefreshCw size={36} color="#0f766e" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <h3 style={{ color: '#0f766e' }}>Loading Emergency Alert Details...</h3>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (errorMessage || !emergencyEvent) {
    return (
      <div style={{ padding: '30px 20px', maxWidth: '640px', margin: '0 auto' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#0f766e',
            background: 'none',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '16px'
          }}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
        <div style={{ backgroundColor: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
          <AlertTriangle size={48} color="#dc2626" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#991b1b', margin: '0 0 8px 0' }}>Alert Not Found</h3>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
            {errorMessage || 'This emergency alert ID does not exist or has expired.'}
          </p>
          <a
            href="tel:112"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <PhoneCall size={18} />
            Call 112 National Emergency
          </a>
        </div>
      </div>
    );
  }

  const badge = getStatusBadge(emergencyEvent.status);
  const isResolved = emergencyEvent.status === 'Resolved' || emergencyEvent.status === 'Cancelled';
  const lat = emergencyEvent.latitude ?? emergencyEvent.location?.latitude;
  const lng = emergencyEvent.longitude ?? emergencyEvent.location?.longitude;
  const hasGps = Boolean(lat !== undefined && lat !== null && lng !== undefined && lng !== null);
  const senderDisplayName = emergencyEvent.senderName || emergencyEvent.patientName || 'Family Member';
  const senderPhone = emergencyEvent.senderPhone || emergencyEvent.patientPhone || '';

  // Google Maps Directions Destination URL (using exact coordinates as source of truth)
  const mapsUrl = hasGps
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px 12px', width: '100%' }}>
      {/* Top Header & Back Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#0f766e',
            background: 'none',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} />
          Return to Dashboard
        </button>

        <button
          onClick={() => loadAlertData(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#64748b',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{refreshing ? 'Updating...' : 'Live Synced'}</span>
        </button>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #f87171',
          borderRadius: '12px',
          padding: '10px 14px',
          color: '#b91c1c',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '14px'
        }}>
          {actionError}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PROMINENT EMERGENCY HEADER CARD                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: isResolved ? '#f0fdf4' : '#fef2f2',
          border: `2px solid ${isResolved ? '#86efac' : '#fca5a5'}`,
          borderRadius: '20px',
          padding: '24px 20px',
          marginBottom: '16px',
          boxShadow: isResolved ? 'none' : '0 10px 25px -5px rgba(220, 38, 38, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <span
            style={{
              backgroundColor: badge.bg,
              color: badge.text,
              border: `1px solid ${badge.border}`,
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}
          >
            {badge.label}
          </span>

          <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={15} />
            {new Date(emergencyEvent.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {/* Exact Prominent Required Headers */}
        <h1 style={{ margin: '0 0 4px 0', fontSize: '26px', color: isResolved ? '#166534' : '#991b1b', fontWeight: 900 }}>
          🚨 EMERGENCY ALERT
        </h1>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: isResolved ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
          {senderDisplayName} may need emergency assistance.
        </h2>

        {/* Sender & Location Availability Summary */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          fontSize: '13px',
          border: '1px solid #fecaca'
        }}>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
              Sender
            </span>
            <strong style={{ color: '#1e293b' }}>{senderDisplayName}</strong>
          </div>

          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
              Location Availability
            </span>
            <strong style={{ color: hasGps ? '#15803d' : '#b45309' }}>
              {hasGps ? 'GPS Coordinates Available' : 'Location Unavailable'}
            </strong>
          </div>

          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
              Alert Time
            </span>
            <strong style={{ color: '#1e293b' }}>
              {new Date(emergencyEvent.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </div>
        </div>

        {/* Action Button Bar: View Location, Call, Acknowledge Alert */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#0f766e',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '12px 18px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '15px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(15, 118, 110, 0.3)'
              }}
            >
              <Navigation size={18} />
              <span>View Location</span>
            </a>
          )}

          {senderPhone ? (
            <a
              href={`tel:${senderPhone.replace(/\s+/g, '')}`}
              style={{
                backgroundColor: '#1e293b',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '12px 18px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '15px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <PhoneCall size={18} />
              <span>Call ({senderPhone})</span>
            </a>
          ) : null}

          {!isResolved && (
            <>
              {emergencyEvent.status !== 'Family Acknowledged' && emergencyEvent.status !== 'Help Is on the Way' && (
                <button
                  type="button"
                  id="btn-acknowledge-alert"
                  onClick={() => setShowAckModal(true)}
                  style={{
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>Acknowledge Alert</span>
                </button>
              )}

              {emergencyEvent.status === 'Family Acknowledged' && (
                <button
                  type="button"
                  onClick={handleSetHelpOnTheWay}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <HeartHandshake size={18} />
                  <span>Mark: Help Is on the Way</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowResolveModal(true)}
                style={{
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '15px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Check size={18} />
                <span>Resolve Alert</span>
              </button>
            </>
          )}

          <a
            href="tel:112"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '12px 16px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '15px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <PhoneCall size={18} />
            <span>Call 112</span>
          </a>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* REAL DELIVERY LIFECYCLE TRACKER (Created -> FCM Sent -> Delivered -> Opened -> Acknowledged) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(() => {
        const isFcmSent = !['SOS Initiated (Push Unavailable)', 'SOS Initiated (No Contacts)', 'SOS Initiated'].includes(emergencyEvent.status) && (emergencyEvent.contactsNotifiedCount === undefined || emergencyEvent.contactsNotifiedCount > 0);
        const isDelivered = ['Delivered to Device', 'Notification Opened', 'Family Acknowledged', 'Help Is on the Way', 'Resolved'].includes(emergencyEvent.status);
        const isOpened = ['Notification Opened', 'Family Acknowledged', 'Help Is on the Way', 'Resolved'].includes(emergencyEvent.status);
        const isAcknowledged = ['Family Acknowledged', 'Help Is on the Way', 'Resolved'].includes(emergencyEvent.status);

        return (
          <div className="card" style={{ padding: '16px 18px', borderRadius: '18px', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f766e', fontWeight: 700 }}>
              Alert Delivery & Response Lifecycle (5 Stages)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center' }}>
              {/* Step 1: Created */}
              <div style={{
                backgroundColor: '#ecfdf5',
                border: '1.5px solid #86efac',
                borderRadius: '10px',
                padding: '8px 4px'
              }}>
                <Check size={18} color="#16a34a" style={{ margin: '0 auto 4px' }} />
                <strong style={{ fontSize: '11px', display: 'block', color: '#166534' }}>Created</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Event Logged</span>
              </div>

              {/* Step 2: FCM Request Sent */}
              <div style={{
                backgroundColor: isFcmSent ? '#ecfdf5' : '#fffbeb',
                border: `1.5px solid ${isFcmSent ? '#86efac' : '#fde68a'}`,
                borderRadius: '10px',
                padding: '8px 4px'
              }}>
                {isFcmSent ? (
                  <Send size={18} color="#16a34a" style={{ margin: '0 auto 4px' }} />
                ) : (
                  <AlertTriangle size={18} color="#d97706" style={{ margin: '0 auto 4px' }} />
                )}
                <strong style={{ fontSize: '11px', display: 'block', color: isFcmSent ? '#166534' : '#b45309' }}>FCM Sent</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{isFcmSent ? 'Dispatched' : 'Push Unavail.'}</span>
              </div>

              {/* Step 3: Delivered */}
              <div style={{
                backgroundColor: isDelivered ? '#ecfdf5' : '#f8fafc',
                border: `1.5px solid ${isDelivered ? '#86efac' : '#e2e8f0'}`,
                borderRadius: '10px',
                padding: '8px 4px'
              }}>
                <CheckCheck size={18} color={isDelivered ? '#16a34a' : '#94a3b8'} style={{ margin: '0 auto 4px' }} />
                <strong style={{ fontSize: '11px', display: 'block', color: isDelivered ? '#166534' : '#64748b' }}>Delivered</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Device Confirmed</span>
              </div>

              {/* Step 4: Opened */}
              <div style={{
                backgroundColor: isOpened ? '#ecfdf5' : '#f8fafc',
                border: `1.5px solid ${isOpened ? '#86efac' : '#e2e8f0'}`,
                borderRadius: '10px',
                padding: '8px 4px'
              }}>
                <Eye size={18} color={isOpened ? '#16a34a' : '#94a3b8'} style={{ margin: '0 auto 4px' }} />
                <strong style={{ fontSize: '11px', display: 'block', color: isOpened ? '#166534' : '#64748b' }}>Opened</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Screen Viewed</span>
              </div>

              {/* Step 5: Acknowledged */}
              <div style={{
                backgroundColor: isAcknowledged ? '#ecfdf5' : '#f8fafc',
                border: `1.5px solid ${isAcknowledged ? '#86efac' : '#e2e8f0'}`,
                borderRadius: '10px',
                padding: '8px 4px'
              }}>
                <CheckCircle2 size={18} color={isAcknowledged ? '#16a34a' : '#94a3b8'} style={{ margin: '0 auto 4px' }} />
                <strong style={{ fontSize: '11px', display: 'block', color: isAcknowledged ? '#166534' : '#64748b' }}>Acknowledged</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Family Responding</span>
              </div>
            </div>

            {/* Multi-Channel Delivery Stats */}
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>🔔 Mobile Push:</span>
                <span style={{ color: emergencyEvent.contactsNotifiedCount && emergencyEvent.contactsNotifiedCount > 0 ? '#15803d' : '#b45309', fontWeight: 600 }}>
                  {emergencyEvent.contactsNotifiedCount && emergencyEvent.contactsNotifiedCount > 0
                    ? `${emergencyEvent.contactsNotifiedCount} sent`
                    : 'Push notifications unavailable'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>📧 Family Email:</span>
                <span style={{ color: ((emergencyEvent.emailsQueuedCount || 0) + (emergencyEvent.emailsSentCount || 0)) > 0 ? '#15803d' : '#64748b', fontWeight: 600 }}>
                  {((emergencyEvent.emailsQueuedCount || 0) + (emergencyEvent.emailsSentCount || 0)) > 0
                    ? `${(emergencyEvent.emailsQueuedCount || 0) + (emergencyEvent.emailsSentCount || 0)} queued/sent`
                    : (emergencyEvent.emailsFailedCount && emergencyEvent.emailsFailedCount > 0)
                      ? `${emergencyEvent.emailsFailedCount} failed`
                      : 'None configured'}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* GPS MAP SECTION (Coordinates as Source of Truth)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '18px', borderRadius: '18px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} />
          Sender GPS Coordinates
        </h3>

        {hasGps && lat !== undefined && lng !== undefined ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: '#334155' }}>
                Latitude: <strong>{lat.toFixed(6)}</strong>, Longitude: <strong>{lng.toFixed(6)}</strong>
                {emergencyEvent.locationAccuracy ? ` (accuracy ~${Math.round(emergencyEvent.locationAccuracy)}m)` : ''}
              </span>

              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    textDecoration: 'none',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Navigation size={14} />
                  <span>View Location in Google Maps</span>
                </a>
              )}
            </div>

            {/* Embedded OSM Map */}
            <div
              style={{
                width: '100%',
                height: '240px',
                borderRadius: '14px',
                overflow: 'hidden',
                border: '1.5px solid #cbd5e1'
              }}
            >
              <iframe
                title="Emergency Location Map"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.008}%2C${lng + 0.008}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`}
              />
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
              Current GPS coordinates could not be obtained when this emergency alert was triggered. No fictional location has been generated. Please contact the patient directly.
            </p>
          </div>
        )}
      </div>

      {/* Acknowledged Banner */}
      {emergencyEvent.acknowledgedBy && (
        <div style={{ backgroundColor: '#fef3c7', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#d97706" />
            Acknowledged by {emergencyEvent.acknowledgedBy.responderName} ({emergencyEvent.acknowledgedBy.responderRelation || 'Family'})
          </h4>
          <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#78350f' }}>
            "{emergencyEvent.acknowledgedBy.message || 'Alert acknowledged'}"
          </p>
          <span style={{ fontSize: '12px', color: '#92400e' }}>
            {new Date(emergencyEvent.acknowledgedBy.acknowledgedAt).toLocaleString('en-IN')}
            {emergencyEvent.acknowledgedBy.responderPhone ? ` • ${emergencyEvent.acknowledgedBy.responderPhone}` : ''}
          </span>
        </div>
      )}

      {/* Resolved Banner */}
      {emergencyEvent.resolvedBy && (
        <div style={{ backgroundColor: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#059669" />
            Resolved by {emergencyEvent.resolvedBy.resolvedBy}
          </h4>
          <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#047857' }}>
            "{emergencyEvent.resolvedBy.resolutionNotes || 'Emergency situation resolved safely.'}"
          </p>
          <span style={{ fontSize: '12px', color: '#065f46' }}>
            {new Date(emergencyEvent.resolvedBy.resolvedAt).toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ACKNOWLEDGE MODAL                                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAckModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => setShowAckModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 6px 0', color: '#92400e', fontSize: '18px', fontWeight: 800 }}>
              Acknowledge Emergency Alert
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Confirm you have received the alert and are taking action.
            </p>

            <form onSubmit={handleAcknowledge}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={ackName}
                  onChange={(e) => setAckName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Relationship to Patient *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spouse, Son, Daughter, Relative"
                  value={ackRelation}
                  onChange={(e) => setAckRelation(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={ackPhone}
                  onChange={(e) => setAckPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Message for Family & Patient
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Alert seen. Heading over right now."
                  value={ackMessage}
                  onChange={(e) => setAckMessage(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAckModal(false)}
                  style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ackSubmitting}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#d97706', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                >
                  {ackSubmitting ? 'Recording...' : 'Confirm Acknowledged'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RESOLVE MODAL                                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showResolveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => setShowResolveModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 6px 0', color: '#047857', fontSize: '18px', fontWeight: 800 }}>
              Resolve Emergency Alert
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Mark this emergency as safely handled and completed.
            </p>

            <form onSubmit={handleResolve}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={resolverName}
                  onChange={(e) => setResolverName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Resolution Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Patient received medical attention and is safe."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveSubmitting}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#059669', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                >
                  {resolveSubmitting ? 'Resolving...' : 'Confirm Resolved'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
