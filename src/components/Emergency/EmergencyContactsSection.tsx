import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  PhoneCall,
  Bell,
  BellOff,
  Edit,
  Trash2,
  CheckCircle2,
  Smartphone,
  AlertCircle,
  X,
  ShieldAlert,
  Mail,
  Send,
  UserCheck,
  Search,
  Sparkles
} from 'lucide-react';
import {
  getEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  cleanDuplicateEmergencyContacts,
  lookupGramCareUser,
  getNotificationStatusBackend
} from '../../services/api';
import {
  requestNotificationPermissionAndGetToken,
  unregisterCurrentDeviceToken,
  verifyDeviceRegistrationStatus
} from '../../services/fcm';
import { EmergencyContact } from '../../types/emergency';
import { EmergencyModal } from './EmergencyModal';
import { useLanguage } from '../../hooks/useLanguage';

interface EmergencyContactsSectionProps {
  onContactsUpdated?: (count: number) => void;
  onViewAlertDetails?: (eventId: string) => void;
}

export const EmergencyContactsSection: React.FC<EmergencyContactsSectionProps> = ({
  onContactsUpdated,
  onViewAlertDetails
}) => {
  const { lang } = useLanguage();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingContact, setEditingContact] = useState<Partial<EmergencyContact> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Device Push Registration Status (Strict backend verification - Requirement 6)
  const [isPushRegistered, setIsPushRegistered] = useState<boolean>(false);
  const [pushRegistering, setPushRegistering] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Duplicate Contacts Cleaning State (Requirement 16)
  const [cleaningDuplicates, setCleaningDuplicates] = useState<boolean>(false);

  // Account Linking Search State in Modal (Requirement 5)
  const [linkSearchQuery, setLinkSearchQuery] = useState<string>('');
  const [linkSearching, setLinkSearching] = useState<boolean>(false);
  const [linkSearchResult, setLinkSearchResult] = useState<{
    found: boolean;
    userId?: string;
    fullName?: string;
    hasPushDevice?: boolean;
    activeDevices?: number;
    isSelf?: boolean;
    message?: string;
  } | null>(null);

  // Targeted SOS Trigger State
  const [contactSosTarget, setContactSosTarget] = useState<{ id: string; name: string } | null>(null);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await getEmergencyContacts();
      setContacts(data);
      if (onContactsUpdated) {
        onContactsUpdated(data.length);
      }
    } catch (err) {
      console.warn('[EmergencyContacts] Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkDevicePushStatus = async () => {
    try {
      const status = await getNotificationStatusBackend();
      setIsPushRegistered(Boolean(status?.registered && status?.activeCount > 0));
    } catch (err) {
      setIsPushRegistered(false);
    }
  };

  useEffect(() => {
    loadContacts();
    checkDevicePushStatus();
  }, []);

  const handleEnableEmergencyAlerts = async () => {
    setPushRegistering(true);
    setStatusNotice(null);
    try {
      // 1. Request notification permission & retrieve token & POST to authenticated backend
      const result = await requestNotificationPermissionAndGetToken();

      if (!result.success) {
        throw new Error(result.error || 'Failed to register notification permission with device.');
      }

      // 4. Verify successful registration with backend
      const checkStatus = await verifyDeviceRegistrationStatus();
      if (!checkStatus.registered) {
        throw new Error('Device token could not be verified with GramCare backend. Please make sure you are logged in.');
      }

      // 5. Refresh contact/device status
      setIsPushRegistered(true);
      await loadContacts();
      setStatusNotice('🟢 Emergency Push Alerts Enabled — This device can receive emergency alerts.');
      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      setIsPushRegistered(false);
      alert(err?.message || 'Could not enable emergency alerts on this device.');
    } finally {
      setPushRegistering(false);
    }
  };

  const handleUnregisterPush = async () => {
    const ok = confirm('Do you want to unregister this device from receiving Emergency push alerts?');
    if (!ok) return;

    await unregisterCurrentDeviceToken();
    setIsPushRegistered(false);
    await checkDevicePushStatus();
    setStatusNotice('Device push notifications unregistered.');
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleCleanDuplicates = async () => {
    setCleaningDuplicates(true);
    try {
      const res = await cleanDuplicateEmergencyContacts();
      if (res.removedCount > 0) {
        setStatusNotice(`Cleaned ${res.removedCount} duplicate contact record(s) safely.`);
      } else {
        setStatusNotice('No duplicate contacts found.');
      }
      await loadContacts();
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to clean duplicate contacts');
    } finally {
      setCleaningDuplicates(false);
    }
  };

  const handleSearchLinkUser = async () => {
    const q = (linkSearchQuery || editingContact?.email || editingContact?.phone || '').trim();
    if (!q) {
      alert('Please enter a phone number, email address, or GramCare User ID to search.');
      return;
    }
    setLinkSearching(true);
    setLinkSearchResult(null);
    try {
      const res = await lookupGramCareUser(q);
      setLinkSearchResult(res);
      if (res.found && res.userId) {
        setEditingContact(prev => prev ? { ...prev, contactUserId: res.userId } : prev);
      }
    } catch (err: any) {
      setLinkSearchResult({ found: false, message: err?.message || 'Search failed' });
    } finally {
      setLinkSearching(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editingContact.fullName?.trim()) {
      alert('Please enter a full name.');
      return;
    }

    const trimmedPhone = editingContact.phone?.trim() || '';
    const trimmedEmail = editingContact.email?.trim() || '';

    if (!trimmedPhone && !trimmedEmail) {
      alert('Please provide at least a phone number or an email address.');
      return;
    }

    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        alert('Please enter a valid email address (e.g. family@gmail.com).');
        return;
      }
    }

    try {
      if (editingContact.id) {
        // Update
        const updated = await updateEmergencyContact(editingContact.id, {
          fullName: editingContact.fullName.trim(),
          relation: editingContact.relation,
          phone: trimmedPhone || undefined,
          email: trimmedEmail.toLowerCase() || undefined,
          contactUserId: editingContact.contactUserId?.trim() || undefined,
          notifyOnSOS: editingContact.notifyOnSOS ?? true
        });
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        setStatusNotice('Emergency contact updated successfully');
      } else {
        // Create
        const created = await createEmergencyContact({
          fullName: editingContact.fullName.trim(),
          relation: editingContact.relation || 'Family Member',
          phone: trimmedPhone || undefined,
          email: trimmedEmail.toLowerCase() || undefined,
          contactUserId: editingContact.contactUserId?.trim() || undefined,
          notifyOnSOS: true,
          isEmergencyContact: true
        });
        setContacts(prev => [created, ...prev]);
        setStatusNotice('New emergency contact added');
      }
      setIsModalOpen(false);
      setEditingContact(null);
      setLinkSearchResult(null);
      setLinkSearchQuery('');
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Failed to save emergency contact');
    }
  };

  const handleToggleNotify = async (contact: EmergencyContact) => {
    try {
      const updated = await updateEmergencyContact(contact.id, {
        notifyOnSOS: !contact.notifyOnSOS
      });
      setContacts(prev => prev.map(c => c.id === contact.id ? updated : c));
    } catch (err: any) {
      alert(err?.message || 'Failed to update notification setting');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEmergencyContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
      setDeletingId(null);
      setStatusNotice('Emergency contact removed');
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete emergency contact');
    }
  };

  const hasDuplicates = contacts.some(c => c.isDuplicate);

  return (
    <div className="card" style={{ margin: '0 0 20px 0', border: '1.5px solid #ccfbf1' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: '0 0 2px 0', fontSize: '17px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} />
            <span>Emergency Contacts ({contacts.length})</span>
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Registered family members who will receive real-time push notifications when Emergency SOS is triggered.
          </p>
        </div>

        <button
          type="button"
          id="btn-add-emergency-contact"
          onClick={() => {
            setEditingContact({
              fullName: '',
              relation: 'Spouse',
              phone: '',
              email: '',
              contactUserId: '',
              notifyOnSOS: true
            });
            setLinkSearchResult(null);
            setLinkSearchQuery('');
            setIsModalOpen(true);
          }}
          style={{
            backgroundColor: '#0f766e',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <PlusCircle size={15} />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Success Status Notice */}
      {statusNotice && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '12px',
          fontSize: '13px',
          color: '#15803d',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <CheckCircle2 size={16} />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* 🔔 Emergency Notifications Push Banner (Requirement 6) */}
      <div style={{
        backgroundColor: isPushRegistered ? '#f0fdf4' : '#fff7ed',
        border: `1.5px solid ${isPushRegistered ? '#86efac' : '#fed7aa'}`,
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                Emergency Notifications
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: isPushRegistered ? '#166534' : '#c2410c' }}>
                Status:
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: isPushRegistered ? '#15803d' : '#b91c1c',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {isPushRegistered ? '🟢 Emergency Push Alerts Enabled' : '❌ Push notifications not enabled'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '520px' }}>
              {isPushRegistered
                ? 'This device can receive emergency alerts.'
                : 'Allow notifications and register your mobile device with GramCare to receive instant SOS push notifications when family members trigger an emergency alert.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isPushRegistered ? (
              <button
                type="button"
                id="btn-enable-emergency-alerts"
                onClick={handleEnableEmergencyAlerts}
                disabled={pushRegistering}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '9px 16px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: pushRegistering ? 'wait' : 'pointer',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {pushRegistering ? 'REQUESTING...' : 'ENABLE EMERGENCY ALERTS'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUnregisterPush}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '7px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Unregister Device
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Contacts Cleanup Warning Banner (Requirement 16) */}
      {hasDuplicates && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1.5px solid #fef08a',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} color="#d97706" />
            <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
              Duplicate emergency contacts detected with identical phone numbers. The emergency dispatch system automatically deduplicates push notifications so physical devices are never alerted twice.
            </span>
          </div>
          <button
            type="button"
            onClick={handleCleanDuplicates}
            disabled={cleaningDuplicates}
            style={{
              backgroundColor: '#d97706',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {cleaningDuplicates ? 'Cleaning...' : 'Clean Duplicate Contacts'}
          </button>
        </div>
      )}

      {/* Contacts List */}
      {contacts.length === 0 ? (
        <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#475569' }}>
            No emergency contacts added yet.
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Click "+ Add Contact" above to register relatives who should be notified when you press SOS.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {contacts.map((contact) => (
            <div
              key={contact.id}
              style={{
                backgroundColor: contact.notifyOnSOS ? '#ffffff' : '#f8fafc',
                border: `1.5px solid ${contact.notifyOnSOS ? '#ccfbf1' : '#e2e8f0'}`,
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: 700 }}>
                    {contact.fullName}
                  </h4>
                  <span style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    {contact.relation}
                  </span>

                  {/* Duplicate Badge */}
                  {contact.isDuplicate && (
                    <span style={{
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>
                      ⚠️ Duplicate
                    </span>
                  )}

                  {/* Real FCM Device Push Status Badge (Requirement 13) */}
                  {contact.hasPushDevice ? (
                    <span style={{
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      border: '1px solid #86efac',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Smartphone size={12} />
                      🔔 Push Alerts: Enabled
                    </span>
                  ) : (
                    <span style={{
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      border: '1px solid #fca5a5',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      🔔 Push Alerts: Unavailable
                    </span>
                  )}

                  {/* Email Alerts Badge */}
                  {contact.email ? (
                    <span style={{
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Mail size={12} />
                      📧 Email Alerts: Available
                    </span>
                  ) : (
                    <span style={{
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      📧 Email Alerts: Not configured
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '12px', color: '#475569', flexWrap: 'wrap' }}>
                  {contact.phone ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <PhoneCall size={13} color="#0f766e" />
                      <span>📱 Phone: <strong>{contact.phone}</strong></span>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                      <PhoneCall size={13} color="#94a3b8" />
                      <span>📱 Phone: <em>Not provided</em></span>
                    </span>
                  )}
                  {contact.email ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={13} color="#0f766e" />
                      <span>📧 Email: <strong>{contact.email}</strong></span>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                      <Mail size={13} color="#94a3b8" />
                      <span>📧 Email: <em>Not configured</em></span>
                    </span>
                  )}
                  {contact.contactUserId && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0369a1' }}>
                      <UserCheck size={12} />
                      Linked Account {contact.linkedUserName ? `(${contact.linkedUserName})` : ''}
                    </span>
                  )}
                </div>

                {/* Subtitle with Resolution Reason */}
                {contact.statusReason && !contact.hasPushDevice && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                    {contact.statusReason}
                  </p>
                )}
              </div>

              {/* Actions & Notify Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Contact-Specific SOS Trigger */}
                <button
                  type="button"
                  onClick={() => setContactSosTarget({ id: contact.id, name: contact.fullName })}
                  title={`Trigger SOS notification directly to ${contact.fullName}`}
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <ShieldAlert size={13} />
                  <span>Alert {contact.relation}</span>
                </button>

                {/* SOS Notification Participation Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleNotify(contact)}
                  title={contact.notifyOnSOS ? 'Disable SOS Notifications for this contact' : 'Enable SOS Notifications'}
                  style={{
                    backgroundColor: contact.notifyOnSOS ? '#ecfdf5' : '#f1f5f9',
                    color: contact.notifyOnSOS ? '#047857' : '#64748b',
                    border: `1px solid ${contact.notifyOnSOS ? '#a7f3d0' : '#cbd5e1'}`,
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {contact.notifyOnSOS ? <Bell size={13} /> : <BellOff size={13} />}
                  <span>{contact.notifyOnSOS ? 'SOS ON' : 'SOS OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(contact);
                    setLinkSearchQuery(contact.email || contact.phone || '');
                    setLinkSearchResult(null);
                    setIsModalOpen(true);
                  }}
                  title="Edit Contact"
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  <Edit size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingId(contact.id)}
                  title="Remove Contact"
                  style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', maxWidth: '380px', width: '100%', padding: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#991b1b', fontSize: '17px' }}>Delete Emergency Contact?</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              This family member will no longer receive emergency alerts when you trigger SOS.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal with Family Member Account Linking (Requirement 5) */}
      {isModalOpen && editingContact && (
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
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              onClick={() => {
                setIsModalOpen(false);
                setEditingContact(null);
                setLinkSearchResult(null);
              }}
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

            <h3 style={{ margin: '0 0 14px 0', color: '#0f766e', fontSize: '18px', fontWeight: 800 }}>
              {editingContact.id ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
            </h3>

            <form onSubmit={handleSaveContact}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={editingContact.fullName || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, fullName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Relationship *
                </label>
                <select
                  value={editingContact.relation || 'Spouse'}
                  onChange={(e) => setEditingContact({ ...editingContact, relation: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Son">Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Brother">Brother</option>
                  <option value="Sister">Sister</option>
                  <option value="Grandfather">Grandfather</option>
                  <option value="Grandmother">Grandmother</option>
                  <option value="Neighbor">Neighbor</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mobile Number (Optional if email provided)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={editingContact.phone || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Email Address (Optional if phone provided)
                </label>
                <input
                  type="email"
                  placeholder="family@gmail.com"
                  value={editingContact.email || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  A valid Gmail or email address can receive emergency alerts without needing a GramCare account.
                </span>
              </div>

              {/* GramCare Account Linking Box (Requirement 5) */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '18px'
              }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f766e', marginBottom: '4px' }}>
                  🔗 Link GramCare User Account
                </label>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b' }}>
                  Link this contact to their registered GramCare mobile app so they receive push notifications.
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search by relative's email, phone, or User ID"
                    value={linkSearchQuery || editingContact.contactUserId || ''}
                    onChange={(e) => {
                      setLinkSearchQuery(e.target.value);
                      setEditingContact({ ...editingContact, contactUserId: e.target.value });
                    }}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  <button
                    type="button"
                    onClick={handleSearchLinkUser}
                    disabled={linkSearching}
                    style={{
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Search size={13} />
                    <span>{linkSearching ? 'Searching...' : 'Verify'}</span>
                  </button>
                </div>

                {linkSearchResult && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    backgroundColor: linkSearchResult.found ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${linkSearchResult.found ? '#86efac' : '#fef08a'}`,
                    color: linkSearchResult.found ? '#166534' : '#92400e'
                  }}>
                    {linkSearchResult.found ? (
                      <div>
                        <strong>✅ Verified GramCare User:</strong> {linkSearchResult.fullName}
                        <br />
                        <span style={{ fontSize: '11px' }}>
                          {linkSearchResult.hasPushDevice
                            ? `📱 Ready for push alerts (${linkSearchResult.activeDevices} registered device(s))`
                            : '⚠️ Account exists, but no active mobile push alerts registered yet.'}
                        </span>
                      </div>
                    ) : (
                      <div>
                        {linkSearchResult.isSelf
                          ? '⚠️ Cannot link your own account as an emergency contact.'
                          : `ℹ️ ${linkSearchResult.message || 'No registered GramCare user found yet. You can still save this contact.'}`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingContact(null);
                    setLinkSearchResult(null);
                  }}
                  style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#0f766e', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Target Contact Emergency Modal */}
      {contactSosTarget && (
        <EmergencyModal
          isOpen={Boolean(contactSosTarget)}
          onClose={() => setContactSosTarget(null)}
          onViewAlertDetails={onViewAlertDetails}
          targetContactId={contactSosTarget.id}
          targetContactName={contactSosTarget.name}
        />
      )}
    </div>
  );
};
