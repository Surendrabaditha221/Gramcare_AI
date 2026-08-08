export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'SERVICE_UNAVAILABLE' | 'RECONNECTING';

export type InternetStatus = 'ONLINE' | 'OFFLINE';
export type BackendStatus = 'CONNECTED' | 'RECONNECTING' | 'UNREACHABLE';

export type FeatureKey =
  | 'emergency_call'
  | 'offline_first_aid'
  | 'ai_chat'
  | 'online_symptom_triage'
  | 'document_analysis'
  | 'cloud_record_sync'
  | 'cloud_patient_ops';

export interface ConnectivityState {
  status: NetworkStatus;
  internetStatus: InternetStatus;
  backendStatus: BackendStatus;
  isOnline: boolean;
  isBackendAvailable: boolean;
  isAiServiceAvailable: boolean;
  isBackendChecking: boolean;
  rawBrowserOnline: boolean;
  retryCount: number;
  lastCheckedAt: number | null;
  showReconnectedToast: boolean;
  showOfflineToast: boolean;
  showServiceUnavailableToast: boolean;
}

export interface ConnectivityContextType extends ConnectivityState {
  checkHealthNow: (forceResetRetries?: boolean) => Promise<boolean>;
  dismissToasts: () => void;
  canUseFeature: (feature: FeatureKey) => boolean;
}
