/**
 * Central API Service for GramCare AI Backend Communication
 * Connects frontend to FastAPI backend endpoints with JWT Authorization,
 * persistent MongoDB synchronization, and offline fallback resilience.
 */

import { TriageInput, TriageGuidanceResult } from '../types/triage';
import { ChatMessage } from '../types/chat';
import { DocumentScanResult, HealthRecord } from '../types/records';
import { HealthcareCenter } from '../types/healthCenter';
import { NotificationItem } from '../types/notification';
import { UserProfile, FamilyMember } from '../types/user';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  if (typeof window !== 'undefined' && window.location) {
    const currentHost = window.location.hostname;
    if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      return envUrl.replace(/localhost|127\.0\.0\.1/g, currentHost);
    }
  }
  return envUrl;
}

const API_BASE_URL = getApiBaseUrl();

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
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

/**
 * Check backend health status (GET /health)
 */
export async function checkBackendHealth(): Promise<HealthResponse | null> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) return null;

  const probeEndpoint = async (endpointUrl: string): Promise<HealthResponse | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(endpointUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data: HealthResponse = await response.json();
      return (data && (data.status === 'ok' || data.status === 'running' || data.service)) ? data : null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  };

  let result = await probeEndpoint(`${API_BASE_URL}/health`);
  if (!result) {
    result = await probeEndpoint(`${API_BASE_URL}/api/health`);
  }
  return result;
}

// ─────────────────────────────────────────────
// Authentication APIs
// ─────────────────────────────────────────────

export async function authLogin(email: string, password: string): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function authRegister(
  email: string,
  password: string,
  fullName: string = 'GramCare User',
  preferredLanguage: string = 'en'
): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, preferredLanguage })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function authGoogle(
  idToken: string,
  email?: string,
  fullName?: string,
  profileImage?: string
): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, email, fullName, profileImage })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function authGetMe(token?: string): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders(token)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function authRefreshToken(refreshToken: string): Promise<any | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
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
    const response = await fetch(`${API_BASE_URL}/api/auth/language`, {
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

/**
 * GramCare AI Health Companion Chat (POST /api/chat)
 */
export async function sendChatMessageBackendDetailed(
  message: string,
  patientName: string = 'Primary User',
  language: string = 'en',
  patientContext?: PatientContextPayload,
  userId?: string
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
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        patient_name: patientName,
        language,
        user_id: userId || patientContext?.userId,
        patient_context: patientContext
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
  userId?: string
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
        patient_context: patientContext,
        history: formattedHistory
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
  language: 'en' | 'te' = 'en'
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
export async function fetchFacilitiesBackend(): Promise<HealthcareCenter[] | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/facilities`);
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
 * Fetch Chat History from MongoDB (GET /api/chat/history)
 */
export async function fetchChatHistoryBackend(userId?: string, patientName?: string): Promise<ChatMessage[] | null> {
  try {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (patientName) params.append('patientName', patientName);

    const response = await fetch(`${API_BASE_URL}/api/chat/history?${params.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    const res = await response.json();
    return res.history || [];
  } catch {
    return null;
  }
}

/**
 * Delete Chat Message from MongoDB (DELETE /api/chat/history/{id})
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
