/**
 * Emergency SOS and Family Push Notification Types for GramCare AI
 */

export type EmergencyStatus =
  | 'SOS Initiated'
  | 'Alert Processing'
  | 'Notifications Submitted'
  | 'Alert Sent'
  | 'Delivered to Device'
  | 'Notification Opened'
  | 'Family Acknowledged'
  | 'Help Is on the Way'
  | 'Resolved'
  | 'Cancelled'
  | string;

export interface EmergencyLocation {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  address?: string;
  timestamp?: string;
}

export interface EmergencyEventStatusAudit {
  status: EmergencyStatus | string;
  timestamp: string;
  updatedBy: string;
  notes?: string;
}

export interface EmergencyNotificationRecord {
  contactId: string;
  contactName: string;
  contactPhone?: string;
  email?: string | null;
  emailStatus?: 'queued' | 'sent' | 'failed' | 'email_not_configured' | 'unavailable' | 'not_configured' | string | null;
  deviceToken?: string | null;
  status: 'sent' | 'delivered' | 'opened' | 'acknowledged' | 'unavailable' | 'failed' | string;
  fcmMessageId?: string | null;
  error?: string | null;
  timestamp: string;
  deliveredAt?: string;
  openedAt?: string;
  acknowledgedAt?: string;
}

export interface EmergencyEmailRecipientRecord {
  contactId?: string | null;
  contactName?: string | null;
  email: string;
  status: 'queued' | 'sent' | 'failed' | 'email_not_configured' | string;
  mailJobId?: string | null;
  error?: string | null;
  timestamp: string;
}

export interface EmergencyEmailDeliveryRecord {
  attempted: boolean;
  totalRecipients: number;
  queued: number;
  sent: number;
  failed: number;
  unconfigured: number;
  recipients: EmergencyEmailRecipientRecord[];
}

export interface EmergencyAcknowledgedBy {
  responderName: string;
  responderPhone?: string;
  responderRelation?: string;
  message?: string;
  acknowledgedAt: string;
}

export interface EmergencyResolvedBy {
  resolvedBy: string;
  resolutionNotes?: string;
  resolvedAt: string;
}

export interface EmergencyEvent {
  id: string;
  alertId?: string;
  patientUid: string;
  senderUserId?: string;
  patientName: string;
  senderName?: string;
  patientPhone?: string;
  senderPhone?: string;
  status: EmergencyStatus;
  createdAt: string;
  updatedAt: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  locationAvailable?: boolean;
  location?: EmergencyLocation | null;
  notes?: string;
  severity?: string;
  auditTrail: EmergencyEventStatusAudit[];
  notifiedContacts: EmergencyNotificationRecord[];
  contactsNotifiedCount?: number;
  contactsUnavailableCount?: number;
  contactsFailedCount?: number;
  deliveryAttempts?: any;
  emailDelivery?: EmergencyEmailDeliveryRecord | null;
  emailsQueuedCount?: number;
  emailsSentCount?: number;
  emailsFailedCount?: number;
  acknowledgedBy?: EmergencyAcknowledgedBy | null;
  resolvedBy?: EmergencyResolvedBy | null;
}

export interface EmergencyContact {
  id: string;
  patientUid: string;
  fullName: string;
  relation: string;
  phone?: string;
  email?: string;
  contactUserId?: string;
  notifyOnSOS: boolean;
  isEmergencyContact: boolean;
  isActive?: boolean;
  hasPushDevice?: boolean;
  hasEmail?: boolean;
  notificationStatus?: string;
  emailStatus?: string;
  resolutionStatus?: string;
  statusReason?: string;
  isDuplicate?: boolean;
  linkedUserName?: string;
  isVerified?: boolean;
  deviceTokens?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyAcknowledgePayload {
  responderName: string;
  responderPhone?: string;
  responderRelation?: string;
  message?: string;
}

export interface EmergencyResolvePayload {
  resolvedBy: string;
  resolutionNotes?: string;
}

export interface EmergencySOSPayload {
  location?: EmergencyLocation;
  severity?: string;
  notes?: string;
  targetContactId?: string;
}
