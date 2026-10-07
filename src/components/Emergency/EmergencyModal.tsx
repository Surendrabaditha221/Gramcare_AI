import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  BellRing,
  RotateCcw,
  Check,
  AlertCircle,
  Eye,
  CheckCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { triggerSOSAlert } from '../../services/api';
import { EmergencyEvent, EmergencyLocation } from '../../types/emergency';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewAlertDetails?: (eventId: string) => void;
  targetContactId?: string;
  targetContactName?: string;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  onViewAlertDetails,
  targetContactId,
  targetContactName
}) => {
  // Modal Flow Step: 'confirm' -> 'preparing' -> 'locating' -> 'sending' -> 'result' | 'error'
  const [step, setStep] = useState<'confirm' | 'preparing' | 'locating' | 'sending' | 'result' | 'error'>('confirm');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdEvent, setCreatedEvent] = useState<EmergencyEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showEnableGuide, setShowEnableGuide] = useState<boolean>(false);
  const [showStageExplanation, setShowStageExplanation] = useState<boolean>(false);

  // Reset modal state on open/close
  useEffect(() => {
    if (!isOpen) {
      setStep('confirm');
      setStatusMessage('');
      setLocationWarning(null);
      setErrorMessage(null);
      setCreatedEvent(null);
      setIsSubmitting(false);
      setShowEnableGuide(false);
      setShowStageExplanation(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /**
   * Acquire browser GPS location with strict high accuracy and 15s timeout
   */
  const acquireLocation = (): Promise<EmergencyLocation | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setLocationWarning('Your emergency contacts can still be notified, but your current location could not be obtained.');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: EmergencyLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          setLocationWarning(null);
          resolve(loc);
        },
        (error) => {
          console.warn('[EmergencySOS] Geolocation error or denied:', error.message);
          setLocationWarning('Your emergency contacts can still be notified, but your current location could not be obtained.');
          // Never fabricate coordinates
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  };

  /**
   * Complete SOS Flow Trigger
   */
  const handleConfirmAndSend = async () => {
    if (isSubmitting) return; // Prevent double-clicks
    setIsSubmitting(true);
    setErrorMessage(null);

    // 1. Preparing state
    setStep('preparing');
    setStatusMessage('Preparing emergency alert...');

    // Small delay to allow UI to render cleanly
    await new Promise((r) => setTimeout(r, 400));

    // 2. Getting location state
    setStep('locating');
    setStatusMessage('Getting your location...');

    const acquiredLoc = await acquireLocation();

    // 3. Sending state
    setStep('sending');
    setStatusMessage('Sending emergency alert...');

    try {
      const event = await triggerSOSAlert({
        location: acquiredLoc || undefined,
        severity: 'CRITICAL',
        notes: targetContactName
          ? `Emergency SOS alert directed to ${targetContactName}`
          : 'Emergency SOS alert initiated from mobile/web app',
        targetContactId: targetContactId || undefined
      });

      setCreatedEvent(event);
      const notifiedCount = event.contactsNotifiedCount ?? 0;
      const emailsQueued = event.emailsQueuedCount ?? 0;
      const emailsSent = event.emailsSentCount ?? 0;
      const anyDispatched = (notifiedCount + emailsQueued + emailsSent) > 0;
      if (!anyDispatched) {
        setShowEnableGuide(true);
      }
      setStep('result');
      setStatusMessage(anyDispatched ? 'Emergency alert sent.' : 'Emergency alert created.');
    } catch (err: any) {
      console.error('[EmergencyModal] SOS submission failed:', err);
      setErrorMessage(err?.message || 'Unable to reach the emergency service.');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.3)',
          border: '2px solid #fecaca',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        {step !== 'preparing' && step !== 'locating' && step !== 'sending' && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <X size={20} color="#475569" />
          </button>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 1: CONFIRMATION DIALOG                                    */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '2px solid #f87171',
                  borderRadius: '50%',
                  width: '72px',
                  height: '72px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                  boxShadow: '0 0 25px rgba(220, 38, 38, 0.35)'
                }}
              >
                <ShieldAlert size={40} color="#dc2626" />
              </div>
              <h2 style={{ margin: '0 0 8px 0', color: '#991b1b', fontSize: '24px', fontWeight: 800 }}>
                🚨 Send Emergency Alert?
              </h2>
              <p style={{ margin: 0, fontSize: '15px', color: '#334155', fontWeight: 500, lineHeight: '1.5' }}>
                {targetContactName
                  ? `This will notify ${targetContactName} and share your current location.`
                  : 'This will notify all your active emergency contacts and share your current location.'}
              </p>
              {targetContactName && (
                <div style={{ marginTop: '8px', display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
                  Targeting: {targetContactName}
                </div>
              )}
            </div>

            {/* Confirmation Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                id="btn-send-emergency-alert"
                onClick={handleConfirmAndSend}
                disabled={isSubmitting}
                className="btn btn-emergency"
                style={{
                  fontSize: '18px',
                  padding: '16px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                <BellRing size={22} />
                <span>SEND ALERT</span>
              </button>

              <button
                type="button"
                id="btn-cancel-emergency-alert"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>

            {/* Direct Official Helpline Shortcuts */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Direct Emergency Call
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <a
                  href="tel:112"
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1.5px solid #f87171',
                    borderRadius: '12px',
                    padding: '10px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: '#dc2626',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  <PhoneCall size={15} />
                  <span>Call 112 (All Emergency)</span>
                </a>
                <a
                  href="tel:108"
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '12px',
                    padding: '10px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: '#15803d',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  <PhoneCall size={15} />
                  <span>Call 108 (Ambulance)</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 2, 3, 4: PROGRESS STATES                                  */}
        {/* ───────────────────────────────────────────────────────────── */}
        {(step === 'preparing' || step === 'locating' || step === 'sending') && (
          <div style={{ textAlign: 'center', padding: '36px 12px' }}>
            <Loader2
              size={56}
              color="#dc2626"
              style={{
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }}
            />
            <h3 style={{ color: '#991b1b', fontSize: '22px', fontWeight: 800, margin: '0 0 10px 0' }}>
              {statusMessage}
            </h3>

            {step === 'locating' && (
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                Requesting high-accuracy GPS coordinates (up to 15s)...
              </p>
            )}

            {step === 'sending' && (
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                Broadcasting high-priority push notifications to registered family devices.
              </p>
            )}

            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 5: FINAL RESULT                                           */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'result' && createdEvent && (() => {
          const contactsNotifiedCount = createdEvent.contactsNotifiedCount ?? 0;
          const contactsUnavailableCount = createdEvent.contactsUnavailableCount ?? 0;
          const isZeroNotified = contactsNotifiedCount === 0;
          const emailsQueuedCount = createdEvent.emailsQueuedCount ?? 0;
          const emailsSentCount = createdEvent.emailsSentCount ?? 0;
          const emailsFailedCount = createdEvent.emailsFailedCount ?? 0;
          const totalEmailDispatched = emailsQueuedCount + emailsSentCount;
          const totalChannelsActive = contactsNotifiedCount + totalEmailDispatched;
          const isZeroChannels = totalChannelsActive === 0;

          const hasDelivered =
            createdEvent.status === 'Delivered to Device' ||
            Boolean(createdEvent.notifiedContacts?.some((c) => c.status === 'delivered'));

          const hasOpened =
            createdEvent.status === 'Notification Opened' ||
            Boolean(createdEvent.notifiedContacts?.some((c) => c.status === 'opened'));

          const hasAcknowledged =
            ['Family Acknowledged', 'Help Is on the Way', 'Resolved'].includes(createdEvent.status) ||
            Boolean(createdEvent.acknowledgedBy) ||
            Boolean(createdEvent.notifiedContacts?.some((c) => c.status === 'acknowledged'));

          return (
            <div>
              {/* Result Title & Icon Header */}
              <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                <div
                  style={{
                    backgroundColor: isZeroChannels ? '#fffbeb' : '#ecfdf5',
                    border: `2px solid ${isZeroChannels ? '#f59e0b' : '#34d399'}`,
                    borderRadius: '50%',
                    width: '64px',
                    height: '64px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px'
                  }}
                >
                  {isZeroChannels ? (
                    <AlertTriangle size={36} color="#d97706" />
                  ) : (
                    <CheckCircle2 size={36} color="#059669" />
                  )}
                </div>

                <h2
                  style={{
                    margin: '0 0 6px 0',
                    color: isZeroChannels ? '#92400e' : '#065f46',
                    fontSize: '22px',
                    fontWeight: 800
                  }}
                >
                  {isZeroChannels ? '⚠️ Emergency alert created' : '🚨 Emergency Alert Sent'}
                </h2>

                {isZeroChannels ? (
                  <>
                    <p style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#b45309', fontWeight: 700 }}>
                      Emergency event created, but no notification channel was available.
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#475569', lineHeight: '1.4' }}>
                      Your emergency contacts do not currently have push notifications enabled or configured email addresses.
                    </p>
                  </>
                ) : (
                  <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#047857', fontWeight: 700 }}>
                    Emergency alert dispatched across family contacts.
                  </p>
                )}

                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Alert ID: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{createdEvent.id}</code>
                </p>
              </div>

              {/* Location Notice Banner if GPS denied */}
              {locationWarning && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#92400e'
                  }}
                >
                  <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0 }} />
                  <span>{locationWarning}</span>
                </div>
              )}

              {/* 5 Distinct Emergency Lifecycle Stages */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Emergency Alert Stages
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStageExplanation(!showStageExplanation)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0f766e',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0
                    }}
                  >
                    <Info size={13} />
                    <span>{showStageExplanation ? 'Hide Details' : 'What do these mean?'}</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center' }}>
                  {/* 1. Emergency event created */}
                  <div
                    style={{
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #86efac',
                      borderRadius: '8px',
                      padding: '6px 2px'
                    }}
                  >
                    <Check size={14} color="#16a34a" style={{ margin: '0 auto 2px' }} />
                    <strong style={{ fontSize: '10px', display: 'block', color: '#166534', lineHeight: 1.2 }}>Created</strong>
                    <span style={{ fontSize: '9px', color: '#64748b', display: 'block', lineHeight: 1.1 }}>Event logged</span>
                  </div>

                  {/* 2. FCM request sent */}
                  <div
                    style={{
                      backgroundColor: !isZeroNotified ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${!isZeroNotified ? '#86efac' : '#fde68a'}`,
                      borderRadius: '8px',
                      padding: '6px 2px'
                    }}
                  >
                    {!isZeroNotified ? (
                      <Check size={14} color="#16a34a" style={{ margin: '0 auto 2px' }} />
                    ) : (
                      <AlertTriangle size={14} color="#d97706" style={{ margin: '0 auto 2px' }} />
                    )}
                    <strong style={{ fontSize: '10px', display: 'block', color: !isZeroNotified ? '#166534' : '#b45309', lineHeight: 1.2 }}>
                      FCM Sent
                    </strong>
                    <span style={{ fontSize: '9px', color: '#64748b', display: 'block', lineHeight: 1.1 }}>
                      {!isZeroNotified ? `${contactsNotifiedCount} sent` : 'Push unavail.'}
                    </span>
                  </div>

                  {/* 3. Device delivered */}
                  <div
                    style={{
                      backgroundColor: hasDelivered ? '#ecfdf5' : '#f8fafc',
                      border: `1px solid ${hasDelivered ? '#86efac' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '6px 2px'
                    }}
                  >
                    <CheckCheck size={14} color={hasDelivered ? '#16a34a' : '#94a3b8'} style={{ margin: '0 auto 2px' }} />
                    <strong style={{ fontSize: '10px', display: 'block', color: hasDelivered ? '#166534' : '#64748b', lineHeight: 1.2 }}>
                      Delivered
                    </strong>
                    <span style={{ fontSize: '9px', color: '#64748b', display: 'block', lineHeight: 1.1 }}>
                      {hasDelivered ? 'On device' : 'Awaiting'}
                    </span>
                  </div>

                  {/* 4. Alert opened */}
                  <div
                    style={{
                      backgroundColor: hasOpened ? '#ecfdf5' : '#f8fafc',
                      border: `1px solid ${hasOpened ? '#86efac' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '6px 2px'
                    }}
                  >
                    <Eye size={14} color={hasOpened ? '#16a34a' : '#94a3b8'} style={{ margin: '0 auto 2px' }} />
                    <strong style={{ fontSize: '10px', display: 'block', color: hasOpened ? '#166534' : '#64748b', lineHeight: 1.2 }}>
                      Opened
                    </strong>
                    <span style={{ fontSize: '9px', color: '#64748b', display: 'block', lineHeight: 1.1 }}>
                      {hasOpened ? 'Viewed' : 'Awaiting'}
                    </span>
                  </div>

                  {/* 5. Alert acknowledged */}
                  <div
                    style={{
                      backgroundColor: hasAcknowledged ? '#ecfdf5' : '#f8fafc',
                      border: `1px solid ${hasAcknowledged ? '#86efac' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '6px 2px'
                    }}
                  >
                    <CheckCircle2 size={14} color={hasAcknowledged ? '#16a34a' : '#94a3b8'} style={{ margin: '0 auto 2px' }} />
                    <strong style={{ fontSize: '10px', display: 'block', color: hasAcknowledged ? '#166534' : '#64748b', lineHeight: 1.2 }}>
                      Acknowledged
                    </strong>
                    <span style={{ fontSize: '9px', color: '#64748b', display: 'block', lineHeight: 1.1 }}>
                      {hasAcknowledged ? 'Responding' : 'Awaiting'}
                    </span>
                  </div>
                </div>

                {/* Stage Explanations Dropdown */}
                {showStageExplanation && (
                  <div
                    style={{
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid #e2e8f0',
                      fontSize: '11px',
                      color: '#475569',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      lineHeight: '1.4'
                    }}
                  >
                    <div>• <strong>Emergency event created:</strong> Alert is logged in the system with Alert ID and GPS data.</div>
                    <div>• <strong>FCM request sent:</strong> High-priority push dispatch request sent to Google FCM gateway.</div>
                    <div>• <strong>Device delivered:</strong> Notification confirmed received on recipient hardware.</div>
                    <div>• <strong>Alert opened:</strong> Recipient tapped notification or viewed emergency details.</div>
                    <div>• <strong>Alert acknowledged:</strong> Recipient explicitly confirmed they are responding.</div>
                  </div>
                )}
              </div>

              {/* Notification Delivery Breakdown */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '14px',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ color: '#1e293b' }}>Family Contacts:</span>
                  <span style={{ color: '#0f766e' }}>{createdEvent.notifiedContacts?.length ?? 0}</span>
                </div>

                {/* Channel Grid: Push & Email */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  {/* Push Notifications Card */}
                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 700, fontSize: '12px', color: '#1e293b' }}>
                      <span>🔔</span>
                      <span>Push Notifications</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                      • {contactsNotifiedCount} sent
                    </div>
                    <div style={{ fontSize: '12px', color: contactsUnavailableCount > 0 ? '#b45309' : '#64748b' }}>
                      • {contactsUnavailableCount} unavailable
                    </div>
                  </div>

                  {/* Email Alerts Card */}
                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 700, fontSize: '12px', color: '#1e293b' }}>
                      <span>📧</span>
                      <span>Email Alerts</span>
                    </div>
                    <div style={{ fontSize: '12px', color: totalEmailDispatched > 0 ? '#15803d' : '#64748b', fontWeight: 600 }}>
                      • {totalEmailDispatched} queued/sent
                    </div>
                    <div style={{ fontSize: '12px', color: emailsFailedCount > 0 ? '#dc2626' : '#64748b' }}>
                      • {emailsFailedCount} failed
                    </div>
                  </div>
                </div>

                {/* Per-Contact Detailed Status */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                    Contact-by-Contact Channel Status
                  </span>
                  {(!createdEvent.notifiedContacts || createdEvent.notifiedContacts.length === 0) ? (
                    <span style={{ fontSize: '13px', color: '#64748b' }}>No emergency contacts registered yet.</span>
                  ) : (
                    createdEvent.notifiedContacts.map((c, i) => {
                      const contactName = c.contactName || 'Contact';

                      // Push status label & color
                      let pushLabel = 'Unavailable';
                      let pushColor = '#b45309';
                      let pushBg = '#fffbeb';
                      if (c.status === 'acknowledged') {
                        pushLabel = 'Acknowledged';
                        pushColor = '#047857';
                        pushBg = '#ecfdf5';
                      } else if (c.status === 'opened') {
                        pushLabel = 'Opened';
                        pushColor = '#0369a1';
                        pushBg = '#f0f9ff';
                      } else if (c.status === 'delivered') {
                        pushLabel = 'Delivered';
                        pushColor = '#16a34a';
                        pushBg = '#f0fdf4';
                      } else if (c.status === 'sent') {
                        pushLabel = 'Sent';
                        pushColor = '#15803d';
                        pushBg = '#f0fdf4';
                      } else if (c.status === 'failed') {
                        pushLabel = 'Failed';
                        pushColor = '#dc2626';
                        pushBg = '#fef2f2';
                      }

                      // Email status label & color
                      let emailLabel = 'Not available';
                      let emailColor = '#64748b';
                      let emailBg = '#f1f5f9';
                      if (c.emailStatus === 'sent') {
                        emailLabel = 'Sent';
                        emailColor = '#047857';
                        emailBg = '#ecfdf5';
                      } else if (c.emailStatus === 'queued') {
                        emailLabel = 'Queued';
                        emailColor = '#0369a1';
                        emailBg = '#e0f2fe';
                      } else if (c.emailStatus === 'email_not_configured') {
                        emailLabel = 'Unconfigured';
                        emailColor = '#b45309';
                        emailBg = '#fffbeb';
                      } else if (c.emailStatus === 'failed') {
                        emailLabel = 'Failed';
                        emailColor = '#dc2626';
                        emailBg = '#fef2f2';
                      } else if (c.email) {
                        emailLabel = 'Available';
                        emailColor = '#0f766e';
                        emailBg = '#f0fdfa';
                      }

                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            gap: '6px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div>
                            <strong style={{ color: '#1e293b' }}>{contactName}</strong>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                              {c.contactPhone ? `📱 ${c.contactPhone}` : ''}
                              {c.contactPhone && c.email ? ' • ' : ''}
                              {c.email ? `📧 ${c.email}` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {/* Email Channel Status */}
                            <span style={{
                              backgroundColor: emailBg,
                              color: emailColor,
                              border: `1px solid ${emailColor}33`,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              📧 Email: {emailLabel}
                            </span>

                            {/* Push Channel Status */}
                            <span style={{
                              backgroundColor: pushBg,
                              color: pushColor,
                              border: `1px solid ${pushColor}33`,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              🔔 Push: {pushLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action: How to enable family notifications */}
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  id="btn-how-to-enable-notifications"
                  onClick={() => setShowEnableGuide(!showEnableGuide)}
                  style={{
                    width: '100%',
                    backgroundColor: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '12px',
                    padding: '11px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#166534',
                    fontWeight: 700,
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HelpCircle size={17} color="#15803d" />
                    <span>How to enable family notifications</span>
                  </div>
                  {showEnableGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showEnableGuide && (
                  <div
                    style={{
                      marginTop: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #bbf7d0',
                      borderRadius: '12px',
                      padding: '14px',
                      fontSize: '13px',
                      color: '#1e293b'
                    }}
                  >
                    <p style={{ margin: '0 0 10px 0', fontWeight: 700, color: '#166534', fontSize: '13px' }}>
                      To receive emergency alerts on family members' devices, each contact must:
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.45' }}>
                      <li>
                        <strong>Have their own GramCare account</strong> — Sign up or log into GramCare on their mobile device or browser.
                      </li>
                      <li>
                        <strong>Enable Emergency Alerts on their phone</strong> — Open the Emergency section or Emergency Contacts settings in GramCare.
                      </li>
                      <li>
                        <strong>Allow notifications</strong> — Grant browser / system notification permissions when prompted.
                      </li>
                      <li>
                        <strong>Register their FCM device</strong> — Click &ldquo;Enable Emergency Alerts&rdquo; to register their phone&rsquo;s push token.
                      </li>
                      <li>
                        <strong>Be linked to the sender&rsquo;s emergency contact</strong> — Ensure their phone number or account is linked as an active Emergency Contact in your profile.
                      </li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {onViewAlertDetails && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewAlertDetails(createdEvent.id);
                  }}
                  style={{
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '14px',
                    fontSize: '16px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <span>Open Live Emergency Dashboard</span>
                  <ArrowRight size={18} />
                </button>
              )}

              <a
                href="tel:112"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  borderRadius: '14px',
                  padding: '12px',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <PhoneCall size={18} />
                <span>Call 112 Emergency Hotline</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  padding: '10px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* STEP 6: ERROR & RETRY                                          */}
        {/* ───────────────────────────────────────────────────────────── */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '10px 4px' }}>
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '2px solid #fca5a5',
                borderRadius: '50%',
                width: '64px',
                height: '64px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px'
              }}
            >
              <AlertTriangle size={36} color="#dc2626" />
            </div>
            <h3 style={{ color: '#991b1b', fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0' }}>
              Unable to reach the emergency service.
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              {errorMessage || 'A network error occurred while communicating with the emergency server.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleConfirmAndSend}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={18} />
                <span>Retry Sending Alert</span>
              </button>

              <a
                href="tel:112"
                style={{
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  borderRadius: '14px',
                  padding: '12px',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <PhoneCall size={18} />
                <span>Call 112 National Emergency</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  padding: '10px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
