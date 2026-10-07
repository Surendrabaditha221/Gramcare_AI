/**
 * Central API Service for GramCare AI Backend Communication
 * Connects frontend to FastAPI backend endpoints with JWT Authorization,
 * persistent MongoDB synchronization, and offline fallback resilience.
 */

import { TriageInput, TriageGuidanceResult } from '../types/triage';
import { ChatMessage, ChatConversation } from '../types/chat';
import { DocumentScanResult, HealthRecord } from '../types/records';
import { HealthcareCenter } from '../types/healthCenter';
import { NotificationItem } from '../types/notification';
import { UserProfile, FamilyMember } from '../types/user';
import {
  EmergencyEvent,
  EmergencyContact,
  EmergencyLocation,
  EmergencyAcknowledgePayload,
  EmergencyResolvePayload
} from '../types/emergency';
import {
  API_BASE_URL,
  getApiBaseUrl,
  buildApiUrl,
  resilientFetch,
  ApiError,
  ApiErrorKind
} from '../config/apiConfig';

export { API_BASE_URL, getApiBaseUrl, buildApiUrl, ApiError };
export type { ApiErrorKind };

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  database?: string;
  ai_available?: boolean;
}

export function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('gramcare_access_token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// In-memory health status cache to prevent flooding the backend
let cachedHealth: { data: HealthResponse | null; timestamp: number } | null = null;
const HEALTH_CACHE_TTL_MS = 6000;
let lastProbeDetails: { targetUrl: string; ok: boolean; statusText?: string } = {
  targetUrl: getApiBaseUrl(),
  ok: false
};

export function getLastProbeDetails() {
  return lastProbeDetails;
}

/**
 * Check backend health status (GET /health or /api/health)
 * Probes both direct LAN address and proxy with fast 2.5s timeouts.
 */
export async function checkBackendHealth(forceRefresh: boolean = false): Promise<HealthResponse | null> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    lastProbeDetails = { targetUrl: getApiBaseUrl(), ok: false, statusText: 'Device offline' };
    return null;
  }

  const now = Date.now();
  if (!forceRefresh && cachedHealth && (now - cachedHealth.timestamp < HEALTH_CACHE_TTL_MS)) {
    return cachedHealth.data;
  }

  const probeEndpoint = async (endpointUrl: string): Promise<HealthResponse | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(endpointUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data: any = await response.json().catch(() => null);
      if (!data) return null;
      const isHealthy = Boolean(
        data.status === 'ok' ||
        data.status === 'running' ||
        data.service ||
        data.database
      );
      return isHealthy ? data : null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  };

  const directBase = getApiBaseUrl();
  let result: HealthResponse | null = null;

  // 1. Direct LAN / environment URL probe
  result = await probeEndpoint(`${directBase}/health`);
  if (!result) {
    result = await probeEndpoint(`${directBase}/api/health`);
  }

  // 2. Relative endpoint probe through Vite dev proxy (fallback for mobile on LAN)
  if (!result && typeof window !== 'undefined') {
    result = await probeEndpoint('/api/health');
    if (!result) {
      result = await probeEndpoint('/health');
    }
  }

  lastProbeDetails = {
    targetUrl: directBase,
    ok: Boolean(result),
    statusText: result ? 'Healthy' : `Unreachable at ${directBase}`
  };

  // ONLY cache successful health status (never cache failures so recovery is instant)
  if (result) {
    cachedHealth = { data: result, timestamp: now };
  } else {
    cachedHealth = null;
  }
  return result;
}

// ─────────────────────────────────────────────
// Authentication APIs
// ─────────────────────────────────────────────

export async function authLogin(email: string, password: string): Promise<any> {
  return await resilientFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    retries: 0,
    timeoutMs: 10000
  });
}

export async function authRegister(
  email: string,
  password: string,
  fullName: string = 'GramCare User',
  preferredLanguage: string = 'en'
): Promise<any> {
  return await resilientFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, preferredLanguage }),
    retries: 0,
    timeoutMs: 12000
  });
}

export async function authGoogle(
  idToken: string,
  email?: string,
  fullName?: string,
  profileImage?: string
): Promise<any> {
  return await resilientFetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, email, fullName, profileImage }),
    retries: 1,
    retryDelayMs: 1200,
    timeoutMs: 15000
  });
}

export async function authPhone(phoneNumber: string): Promise<any> {
  return await resilientFetch('/api/auth/phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
    retries: 0,
    timeoutMs: 8000
  });
}

export async function authGetMe(token?: string): Promise<any | null> {
  try {
    return await resilientFetch('/api/auth/me', {
      method: 'GET',
      headers: getAuthHeaders(token),
      retries: 0,
      timeoutMs: 3500
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[GramCare AI API] authGetMe check notice:', err);
    }
    return null;
  }
}

export async function authRefreshToken(refreshToken: string): Promise<any | null> {
  try {
    const response = await fetch(buildApiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function authSetLanguage(language: string, token?: string): Promise<any | null> {
  try {
    const response = await fetch(buildApiUrl('/api/auth/language'), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ language })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Triage APIs
// ─────────────────────────────────────────────

export async function evaluateTriageBackend(input: TriageInput, userId?: string): Promise<TriageGuidanceResult | null> {
  try {
    const payload = {
      patient: input.patientName || 'Primary User',
      patient_id: input.patientId || 'user_primary',
      user_id: userId || 'user_primary',
      age_group: input.ageGroup || 'adult',
      main_complaint: input.mainComplaint,
      symptom_duration: input.duration,
      severity: input.severity,
      related_symptoms: input.selectedSymptomIds || [],
      warning_signs: input.warningSigns || [],
      additional_details: input.additionalDetails
    };

    const response = await fetch(`${API_BASE_URL}/api/triage`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) return null;
    const res = await response.json();

    return {
      id: `triage_${Date.now()}`,
      patientId: input.patientId || 'user_primary',
      patientName: input.patientName || 'Primary User',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      severity: (res.severity_code || 'low') as any,
      urgencyCategory: (res.urgency_level || 'Non-Urgent Guidance') as any,
      title: res.title_en,
      teluguTitle: res.title_te,
      summary: res.summary_en,
      teluguSummary: res.summary_te,
      reportedSymptoms: [input.mainComplaint, ...(input.selectedSymptomIds || [])],
      teluguReportedSymptoms: [input.mainComplaint, ...(input.selectedSymptomIds || [])],
      recommendedNextActions: res.recommended_next_actions_en || [],
      teluguRecommendedNextActions: res.recommended_next_actions_te || [],
      warningSigns: res.warning_information_en || [],
      teluguWarningSigns: res.warning_information_te || [],
      redFlagWarning: res.severity_code === 'urgent',
      disclaimer: res.disclaimer || 'GramCare AI Triage Guidance Only'
    };
  } catch {
    return null;
  }
}

export interface ChatResult {
  success: boolean;
  message?: ChatMessage;
  errorType?: 'OFFLINE' | 'UNREACHABLE' | 'API_CONFIG_ERROR' | 'UNKNOWN';
  errorDetails?: string;
}

export interface PatientContextPayload {
  userId?: string;
  name: string;
  age?: number;
  gender?: string;
  relation?: string;
  knownAllergies?: string;
  medicalConditions?: string;
  currentMedications?: string;
}

export interface LocationContextPayload {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  source?: 'gps' | 'ip' | 'manual' | 'cache';
  addressName?: string;
  displayName?: string;
}

/**
 * GramCare AI Health Companion Chat (POST /api/chat)
 */
export async function sendChatMessageBackendDetailed(
  message: string,
  patientName: string = 'Primary User',
  language: string = 'en',
  patientContext?: PatientContextPayload,
  userId?: string,
  locationContext?: LocationContextPayload,
  conversationId?: string
): Promise<ChatResult> {
  const url = `${API_BASE_URL}/api/chat`;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    return {
      success: false,
      errorType: 'OFFLINE',
      errorDetails: 'Device is offline'
    };
  }

  try {
    let resolvedLoc = locationContext;
    if (!resolvedLoc && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('gramcare_active_location');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.coords && parsed.coords.source !== 'ip') {
            resolvedLoc = {
              latitude: parsed.coords.latitude,
              longitude: parsed.coords.longitude,
              accuracy: parsed.coords.accuracy,
              source: parsed.coords.source,
              addressName: parsed.address?.displayName
            };
          }
        }
      } catch (locErr) {
        console.warn('[API] Could not retrieve cached location:', locErr);
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        patient_name: patientName,
        language,
        user_id: userId || patientContext?.userId,
        conversation_id: conversationId,
        patient_context: patientContext,
        location_context: resolvedLoc
      })
    });

    if (!response.ok) {
      const errText = `HTTP ${response.status} ${response.statusText}`;
      return {
        success: false,
        errorType: response.status === 401 || response.status === 403 || response.status === 500 ? 'API_CONFIG_ERROR' : 'UNREACHABLE',
        errorDetails: errText
      };
    }

    const data = await response.json();

    const chatMsg: ChatMessage = {
      id: `assistant_msg_${Date.now()}`,
      sender: 'assistant',
      text: data.reply,
      teluguText: data.teluguReply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patientName
    };

    return {
      success: true,
      message: chatMsg
    };
  } catch (err: any) {
    return {
      success: false,
      errorType: 'UNREACHABLE',
      errorDetails: err?.message || 'FastAPI backend server unreachable'
    };
  }
}

export interface StreamChatResult {
  success: boolean;
  aborted?: boolean;
  errorType?: 'OFFLINE' | 'UNREACHABLE' | 'API_CONFIG_ERROR' | 'UNKNOWN';
  errorDetails?: string;
  hasPartialText?: boolean;
}

/**
 * Real-Time Response Streaming Chat Function (POST /api/chat/stream)
 */
export async function streamChatMessageBackend(
  message: string,
  patientName: string = 'Primary User',
  language: string = 'en',
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  patientContext?: PatientContextPayload,
  history?: ChatMessage[],
  userId?: string,
  locationContext?: LocationContextPayload,
  conversationId?: string
): Promise<StreamChatResult> {
  const url = `${API_BASE_URL}/api/chat/stream`;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    return {
      success: false,
      errorType: 'OFFLINE',
      errorDetails: 'Device is offline'
    };
  }

  let receivedAnyChunk = false;

  try {
    let resolvedLoc = locationContext;
    if (!resolvedLoc && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('gramcare_active_location');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.coords && parsed.coords.source !== 'ip') {
            resolvedLoc = {
              latitude: parsed.coords.latitude,
              longitude: parsed.coords.longitude,
              accuracy: parsed.coords.accuracy,
              source: parsed.coords.source,
              addressName: parsed.address?.displayName
            };
          }
        }
      } catch (locErr) {
        console.warn('[API] Could not retrieve cached location:', locErr);
      }
    }

    const formattedHistory = history ? history.map(h => ({
      sender: h.sender,
      text: h.text
    })) : undefined;

    const headers = getAuthHeaders();
    headers['Accept'] = 'text/plain, application/json';

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        patient_name: patientName,
        language,
        user_id: userId || patientContext?.userId,
        conversation_id: conversationId,
        patient_context: patientContext,
        history: formattedHistory,
        location_context: resolvedLoc
      }),
      signal
    });

    if (!response.ok) {
      const errText = `HTTP ${response.status} ${response.statusText}`;
      return {
        success: false,
        errorType: response.status === 401 || response.status === 403 || response.status === 500 ? 'API_CONFIG_ERROR' : 'UNREACHABLE',
        errorDetails: errText
      };
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        const textChunk = decoder.decode(value, { stream: true });
        if (textChunk) {
          receivedAnyChunk = true;
          onChunk(textChunk);
        }
      }
    }

    const finalChunk = decoder.decode();
    if (finalChunk) {
      receivedAnyChunk = true;
      onChunk(finalChunk);
    }

    return {
      success: true,
      hasPartialText: receivedAnyChunk
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        success: false,
        aborted: true,
        hasPartialText: receivedAnyChunk,
        errorDetails: 'Generation stopped by user'
      };
    }
    return {
      success: false,
      hasPartialText: receivedAnyChunk,
      errorType: 'UNREACHABLE',
      errorDetails: err?.message || 'FastAPI backend server unreachable'
    };
  }
}

export async function sendChatMessageBackend(
  message: string,
  patientName: string = 'Primary User',
  language: string = 'en'
): Promise<ChatMessage | null> {
  const result = await sendChatMessageBackendDetailed(message, patientName, language);
  return result.success && result.message ? result.message : null;
}

/**
 * Medical Document / Prescription Analyzer (POST /api/document/analyze)
 */
export async function analyzeDocumentBackend(
  docType: 'Prescription' | 'Medical Report' | 'Health Record',
  patientName: string,
  rawText?: string
): Promise<DocumentScanResult | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/document/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        doc_type: docType,
        patient_name: patientName,
        raw_text: rawText
      })
    });

    if (!response.ok) return null;
    const res = await response.json();

    return {
      id: `scan_${Date.now()}`,
      docType: (res.doc_type || docType) as any,
      extractedPatientName: res.extracted_patient_name || patientName,
      doctorOrLabName: res.doctor_or_lab_name || 'Medical Officer',
      date: res.date || new Date().toISOString().split('T')[0],
      keyFindings: res.key_findings || [],
      medicationsMentioned: res.medications_mentioned || [],
      rawTextPreview: res.follow_up_instructions || rawText || 'Prescription processed successfully.'
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Healthcare Facilities (GET /api/facilities)
 */
export async function fetchFacilitiesBackend(lat?: number, lon?: number, radiusKm: number = 5.0): Promise<HealthcareCenter[] | null> {
  try {
    if (lat === undefined || lon === undefined) return null;
    const response = await fetch(`${API_BASE_URL}/api/facilities?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch Patients List (GET /api/patients?userId=...)
 */
export async function fetchPatientsBackend(userId?: string): Promise<UserProfile[] | null> {
  try {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    const url = `${API_BASE_URL}/api/patients?${params.toString()}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Save Patient / Family Member (POST /api/patients)
 */
export async function savePatientBackend(patient: Partial<UserProfile | FamilyMember>, userId?: string): Promise<any | null> {
  try {
    const payload = { ...patient, userId: userId || (patient as any).userId };
    const response = await fetch(`${API_BASE_URL}/api/patients`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Delete Patient / Family Member (DELETE /api/patients/{id})
 */
export async function deletePatientBackend(patientId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${encodeURIComponent(patientId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch Health Records (GET /api/records?patient_id=...&userId=...)
 */
export async function fetchRecordsBackend(patientId?: string, userId?: string): Promise<HealthRecord[] | null> {
  try {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId);
    if (userId) params.append('userId', userId);
    const url = `${API_BASE_URL}/api/records?${params.toString()}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Save Health Record (POST /api/records)
 */
export async function saveRecordBackend(record: Partial<HealthRecord>, userId?: string): Promise<HealthRecord | null> {
  try {
    const payload = { ...record, userId: userId || (record as any).userId };
    const response = await fetch(`${API_BASE_URL}/api/records`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch Alerts & Reminders (GET /api/alerts)
 */
export async function fetchAlertsBackend(userId?: string): Promise<NotificationItem[] | null> {
  try {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    const response = await fetch(`${API_BASE_URL}/api/alerts?${params.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Post Offline Sync Data (POST /api/sync)
 */
export async function syncOfflineDataBackend(payload: {
  userId?: string;
  patients?: any[];
  records?: any[];
  alerts?: any[];
  triage_logs?: any[];
}, userId?: string): Promise<any | null> {
  try {
    const body = { ...payload, userId: userId || payload.userId };
    const response = await fetch(`${API_BASE_URL}/api/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch User Profile from MongoDB (GET /api/users/profile?userId=...&email=...)
 */
export async function fetchUserProfileBackend(email?: string, userId?: string): Promise<any | null> {
  try {
    const params = new URLSearchParams();
    if (email) params.append('email', email);
    if (userId) params.append('userId', userId);

    const response = await fetch(`${API_BASE_URL}/api/users/profile?${params.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    const res = await response.json();
    return res.found ? res.profile : null;
  } catch {
    return null;
  }
}

/**
 * Save / Update User Profile in MongoDB (POST /api/users/profile)
 */
export async function saveUserProfileBackend(profileData: any): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData)
    });
    if (!response.ok) return null;
    const res = await response.json();
    return res.profile;
  } catch {
    return null;
  }
}

/**
 * Fetch User Settings (GET /api/settings)
 */
export async function fetchUserSettingsBackend(): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Save User Settings (POST /api/settings)
 */
export async function saveUserSettingsBackend(settingsData: any): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(settingsData)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Change Password (POST /api/settings/change-password)
 */
export async function changePasswordBackend(oldPassword: string, newPassword: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ oldPassword, newPassword })
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Delete User Account (DELETE /api/users/account)
 */
export async function deleteAccountBackend(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/account`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch Chat History from Firestore (GET /api/chat/history)
 */
export async function fetchChatHistoryBackend(
  userId?: string,
  patientName?: string,
  conversationId?: string
): Promise<ChatMessage[] | null> {
  try {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (patientName) params.append('patientName', patientName);
    if (conversationId) params.append('conversationId', conversationId);

    const response = await fetch(`${API_BASE_URL}/api/chat/history?${params.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    const res = await response.json();
    return res.history || [];
  } catch {
    return null;
  }
}

/**
 * Fetch all conversations for authenticated user (GET /api/chat/conversations)
 */
export async function fetchConversationsBackend(): Promise<ChatConversation[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const res = await response.json();
    return res.conversations || [];
  } catch (err) {
    console.warn('[API] fetchConversationsBackend error:', err);
    return [];
  }
}

/**
 * Fetch messages for a specific conversation (GET /api/chat/conversations/{id}/messages)
 */
export async function fetchConversationMessagesBackend(conversationId: string): Promise<ChatMessage[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const res = await response.json();
    const rawMsgs = res.messages || [];
    return rawMsgs.map((m: any) => ({
      id: m.id || `msg_${Date.now()}`,
      sender: (m.role === 'user' || m.sender === 'user') ? 'user' : 'assistant',
      text: m.content || m.text || '',
      teluguText: m.teluguText,
      timestamp: m.createdAt
        ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patientName: m.patientName
    }));
  } catch (err) {
    console.warn('[API] fetchConversationMessagesBackend error:', err);
    return [];
  }
}

/**
 * Create a new conversation thread in Firestore (POST /api/chat/conversations)
 */
export async function createConversationBackend(
  title?: string,
  patientName?: string,
  id?: string
): Promise<ChatConversation | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, patientName, id })
    });
    if (!response.ok) return null;
    const res = await response.json();
    return res.conversation || null;
  } catch (err) {
    console.warn('[API] createConversationBackend error:', err);
    return null;
  }
}

/**
 * Rename a conversation thread (PATCH /api/chat/conversations/{id})
 */
export async function renameConversationBackend(conversationId: string, title: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title: title.trim() })
    });
    if (!response.ok) return false;
    const res = await response.json();
    return res.success ?? true;
  } catch (err) {
    console.warn('[API] renameConversationBackend error:', err);
    return false;
  }
}

/**
 * Delete Chat Message from Firestore (DELETE /api/chat/history/{id})
 */
export async function deleteChatHistoryBackend(messageId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/history/${messageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) return false;
    const res = await response.json();
    return res.success || false;
  } catch {
    return false;
  }
}

/**
 * Permanently Delete Conversation and all its messages (DELETE /api/chat/conversations/{id})
 * Strictly scoped to the authenticated user.
 */
export async function deleteConversationBackend(conversationId: string = 'conv_default'): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      // Fallback to /api/chat/clear?conversationId=...
      const fallback = await fetch(`${API_BASE_URL}/api/chat/clear?conversationId=${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!fallback.ok) return false;
      const fbRes = await fallback.json();
      return fbRes.success ?? true;
    }
    const res = await response.json();
    return res.success ?? true;
  } catch (err) {
    console.warn('[API] deleteConversationBackend error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Emergency SOS & Family Notifications Backend APIs
// ─────────────────────────────────────────────────────────────

/**
 * Trigger an authenticated Emergency SOS alert with optional GPS coordinates.
 * POST /api/emergency/sos
 */
export async function triggerSOSAlert(payload: {
  location?: EmergencyLocation;
  notes?: string;
  severity?: string;
  targetContactId?: string;
}): Promise<EmergencyEvent> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/sos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to trigger SOS alert' }));
    throw new Error(err.detail || 'Failed to trigger Emergency SOS alert');
  }

  return response.json();
}

/**
 * Get single Emergency SOS alert by ID.
 * GET /api/emergency/{id}
 */
export async function getEmergencyAlert(id: string): Promise<EmergencyEvent> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Emergency alert not found' }));
    throw new Error(err.detail || 'Emergency alert not found');
  }

  return response.json();
}

/**
 * Retrieve patient's previous emergency alerts.
 * GET /api/emergency/my-alerts
 */
export async function getMyEmergencyAlerts(): Promise<EmergencyEvent[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/emergency/my-alerts`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    return response.json();
  } catch (err) {
    console.warn('[API] getMyEmergencyAlerts error:', err);
    return [];
  }
}

/**
 * Acknowledge an Emergency Alert as a family member.
 * POST /api/emergency/{id}/acknowledge
 */
export async function acknowledgeEmergencyAlert(
  id: string,
  payload: EmergencyAcknowledgePayload
): Promise<EmergencyEvent> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/${encodeURIComponent(id)}/acknowledge`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to acknowledge alert' }));
    throw new Error(err.detail || 'Failed to acknowledge alert');
  }

  return response.json();
}

/**
 * Transition Emergency Alert status (e.g., 'Help Is on the Way').
 * POST /api/emergency/{id}/status
 */
export async function updateEmergencyStatus(
  id: string,
  status: string,
  notes?: string
): Promise<EmergencyEvent> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, notes })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update alert status' }));
    throw new Error(err.detail || 'Failed to update alert status');
  }

  return response.json();
}

/**
 * Resolve an Emergency Alert.
 * POST /api/emergency/{id}/resolve
 */
export async function resolveEmergencyAlert(
  id: string,
  payload: EmergencyResolvePayload
): Promise<EmergencyEvent> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to resolve emergency alert' }));
    throw new Error(err.detail || 'Failed to resolve emergency alert');
  }

  return response.json();
}

/**
 * Report physical delivery of FCM push alert to recipient device.
 * POST /api/emergency/{id}/delivered
 */
export async function markAlertDeliveredBackend(
  id: string,
  source: string = 'client',
  contactId?: string
): Promise<EmergencyEvent | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/emergency/${encodeURIComponent(id)}/delivered`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ source, contactId })
    });
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    console.debug('[API] markAlertDeliveredBackend note:', err);
    return null;
  }
}

/**
 * Report that a recipient opened or viewed the emergency alert.
 * POST /api/emergency/{id}/opened
 */
export async function markAlertOpenedBackend(
  id: string,
  source: string = 'client',
  contactId?: string
): Promise<EmergencyEvent | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/emergency/${encodeURIComponent(id)}/opened`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ source, contactId })
    });
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    console.debug('[API] markAlertOpenedBackend note:', err);
    return null;
  }
}

/**
 * List Emergency Contacts for authenticated patient.
 * GET /api/emergency/contacts
 */
export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/emergency/contacts`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    return response.json();
  } catch (err) {
    console.warn('[API] getEmergencyContacts error:', err);
    return [];
  }
}

/**
 * Add a new Emergency Contact.
 * POST /api/emergency/contacts
 */
export async function createEmergencyContact(contact: Partial<EmergencyContact>): Promise<EmergencyContact> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/contacts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(contact)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to create emergency contact' }));
    throw new Error(err.detail || 'Failed to create emergency contact');
  }

  return response.json();
}

/**
 * Update an existing Emergency Contact.
 * PUT /api/emergency/contacts/{id}
 */
export async function updateEmergencyContact(id: string, updates: Partial<EmergencyContact>): Promise<EmergencyContact> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/contacts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update emergency contact' }));
    throw new Error(err.detail || 'Failed to update emergency contact');
  }

  return response.json();
}

/**
 * Delete an Emergency Contact.
 * DELETE /api/emergency/contacts/{id}
 */
export async function deleteEmergencyContact(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/emergency/contacts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Register FCM device token with backend.
 * POST /api/notifications/register-device
 */
export async function registerDeviceTokenBackend(payload: {
  fcmToken: string;
  deviceType?: string;
  deviceName?: string;
  contactId?: string;
  consentGranted: boolean;
}): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/notifications/register-device`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to register device' }));
    throw new Error(err.detail || 'Failed to register push device');
  }

  return response.json();
}

/**
 * Send test push notification to verify FCM setup.
 * POST /api/notifications/test-push
 */
export async function testPushNotificationBackend(fcmToken: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/notifications/test-push`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fcmToken })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to send test push' }));
    throw new Error(err.detail || 'Failed to send test push');
  }

  return response.json();
}

/**
 * Unregister FCM device token with backend.
 * DELETE /api/notifications/device/{token}
 */
export async function unregisterDeviceTokenBackend(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/device/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check push notification registration status with backend.
 * GET /api/notifications/status
 */
export async function getNotificationStatusBackend(): Promise<{ registered: boolean; activeCount: number; devices: any[] }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/status`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      return { registered: false, activeCount: 0, devices: [] };
    }
    return response.json();
  } catch {
    return { registered: false, activeCount: 0, devices: [] };
  }
}

/**
 * Lookup registered GramCare user by email, phone, or User ID.
 * GET /api/emergency/lookup-user?query=...
 */
export async function lookupGramCareUser(query: string): Promise<{
  found: boolean;
  userId?: string;
  fullName?: string;
  hasPushDevice?: boolean;
  activeDevices?: number;
  isSelf?: boolean;
  message?: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/lookup-user?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Lookup failed' }));
    throw new Error(err.message || 'Lookup failed');
  }

  return response.json();
}

/**
 * Clean redundant duplicate emergency contacts.
 * POST /api/emergency/contacts/clean-duplicates
 */
export async function cleanDuplicateEmergencyContacts(): Promise<{
  success: boolean;
  removedCount: number;
  removed: any[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/emergency/contacts/clean-duplicates`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error('Failed to clean duplicate contacts');
  }

  return response.json();
}



