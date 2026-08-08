import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { NetworkStatus, InternetStatus, BackendStatus, ConnectivityContextType, FeatureKey } from '../types/connectivity';
import { checkBackendHealth } from '../services/api';

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

// Exponential backoff retry delays in seconds (STEP 6)
const BACKOFF_DELAYS_SEC = [2, 5, 10, 20, 20];
const MAX_RETRIES = 5;

export const ConnectivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Real internet connectivity state (strictly navigator.onLine)
  const [rawBrowserOnline, setRawBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const internetStatus: InternetStatus = rawBrowserOnline ? 'ONLINE' : 'OFFLINE';

  // 2. Separate backend health reachability state (CONNECTED | RECONNECTING | UNREACHABLE)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('CONNECTED');
  const [isBackendChecking, setIsBackendChecking] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const retryTimeoutRef = useRef<any>(null);
  const isProbeInProgressRef = useRef<boolean>(false);

  // Derived convenience flags
  const isOnline = internetStatus === 'ONLINE';
  const isBackendAvailable = isOnline && backendStatus === 'CONNECTED';
  const isAiServiceAvailable = isBackendAvailable;

  // Computed status indicator for UI
  const status: NetworkStatus = !isOnline
    ? 'OFFLINE'
    : backendStatus === 'CONNECTED'
    ? 'ONLINE'
    : backendStatus === 'RECONNECTING'
    ? 'RECONNECTING'
    : 'SERVICE_UNAVAILABLE';

  const [toastState, setToastState] = useState<{
    showReconnectedToast: boolean;
    showOfflineToast: boolean;
    showServiceUnavailableToast: boolean;
  }>({
    showReconnectedToast: false,
    showOfflineToast: false,
    showServiceUnavailableToast: false
  });

  const clearPendingRetries = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  /**
   * Health Probe Runner with Exponential Backoff Retry Loop
   */
  const performHealthCheck = useCallback(async (currentRetry: number = 0): Promise<boolean> => {
    const isNavOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setRawBrowserOnline(isNavOnline);

    if (!isNavOnline) {
      clearPendingRetries();
      setBackendStatus('UNREACHABLE');
      setIsBackendChecking(false);
      setRetryCount(0);
      return false;
    }

    if (isProbeInProgressRef.current) {
      return backendStatus === 'CONNECTED';
    }

    isProbeInProgressRef.current = true;
    setIsBackendChecking(true);

    try {
      const healthResult = await checkBackendHealth();
      const isOk = Boolean(healthResult && (healthResult.status === 'ok' || healthResult.status === 'running' || healthResult.service));
      setLastCheckedAt(Date.now());

      if (isOk) {
        // Probe succeeded! Immediately transition to CONNECTED
        clearPendingRetries();
        setBackendStatus('CONNECTED');
        setRetryCount(0);
        setIsBackendChecking(false);
        isProbeInProgressRef.current = false;
        console.log(`[ConnectivityManager] 🟢 Backend CONNECTED (Health Probe Succeeded)`);
        return true;
      } else {
        // Probe failed
        if (currentRetry < MAX_RETRIES) {
          const nextRetry = currentRetry + 1;
          const delaySec = BACKOFF_DELAYS_SEC[currentRetry] || 20;
          setRetryCount(nextRetry);

          // DO NOT show false error during retries! Transition to RECONNECTING while retrying
          setBackendStatus('RECONNECTING');
          setIsBackendChecking(false);
          isProbeInProgressRef.current = false;

          console.warn(`[ConnectivityManager] 🟡 Probe failed. Retrying #${nextRetry}/${MAX_RETRIES} in ${delaySec}s...`);

          clearPendingRetries();
          retryTimeoutRef.current = setTimeout(() => {
            performHealthCheck(nextRetry);
          }, delaySec * 1000);

          return false;
        } else {
          // Max retries exceeded -> Mark UNREACHABLE
          clearPendingRetries();
          setBackendStatus('UNREACHABLE');
          setRetryCount(MAX_RETRIES);
          setIsBackendChecking(false);
          isProbeInProgressRef.current = false;
          console.error(`[ConnectivityManager] 🔴 Probe failed after ${MAX_RETRIES} retries. Backend marked UNREACHABLE.`);
          return false;
        }
      }
    } catch {
      setIsBackendChecking(false);
      isProbeInProgressRef.current = false;
      return false;
    }
  }, [backendStatus]);

  const checkHealthNow = useCallback(async (forceReset: boolean = true): Promise<boolean> => {
    if (forceReset) {
      clearPendingRetries();
      setRetryCount(0);
    }
    return performHealthCheck(0);
  }, [performHealthCheck]);

  // Window Online / Offline / Visibility event handling
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ConnectivityManager] Window "online" event fired -> navigator.onLine: true');
      setRawBrowserOnline(true);
      setToastState({
        showReconnectedToast: true,
        showOfflineToast: false,
        showServiceUnavailableToast: false
      });
      // Probe backend immediately when coming online
      checkHealthNow(true);
    };

    const handleOffline = () => {
      console.log('[ConnectivityManager] Window "offline" event fired -> navigator.onLine: false');
      setRawBrowserOnline(false);
      clearPendingRetries();
      setBackendStatus('UNREACHABLE');
      setIsBackendChecking(false);
      setToastState({
        showReconnectedToast: false,
        showOfflineToast: true,
        showServiceUnavailableToast: false
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const isNavOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (isNavOnline) {
          console.log('[ConnectivityManager] Tab regained focus/visibility -> running health check');
          checkHealthNow(true);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial check on mount
    checkHealthNow(true);

    // Periodic Health Check (every 15s) when internet is online and tab is active
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const isNavOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isNavOnline) {
        if (retryTimeoutRef.current === null && !isProbeInProgressRef.current) {
          performHealthCheck(0);
        }
      } else {
        setRawBrowserOnline(false);
        setBackendStatus('UNREACHABLE');
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      clearPendingRetries();
    };
  }, [checkHealthNow, performHealthCheck]);

  const dismissToasts = useCallback(() => {
    setToastState({
      showReconnectedToast: false,
      showOfflineToast: false,
      showServiceUnavailableToast: false
    });
  }, []);

  const canUseFeature = useCallback(
    (feature: FeatureKey): boolean => {
      const isOnlineState = rawBrowserOnline;
      switch (feature) {
        case 'emergency_call':
        case 'offline_first_aid':
          return true;
        case 'ai_chat':
        case 'online_symptom_triage':
        case 'document_analysis':
          return isOnlineState && isAiServiceAvailable;
        case 'cloud_record_sync':
        case 'cloud_patient_ops':
          return isOnlineState && isBackendAvailable;
        default:
          return isOnlineState;
      }
    },
    [rawBrowserOnline, isBackendAvailable, isAiServiceAvailable]
  );

  return (
    <ConnectivityContext.Provider
      value={{
        status,
        internetStatus,
        backendStatus,
        isOnline,
        isBackendAvailable,
        isAiServiceAvailable,
        isBackendChecking,
        rawBrowserOnline,
        retryCount,
        lastCheckedAt,
        showReconnectedToast: toastState.showReconnectedToast,
        showOfflineToast: toastState.showOfflineToast,
        showServiceUnavailableToast: toastState.showServiceUnavailableToast,
        checkHealthNow,
        dismissToasts,
        canUseFeature
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = (): ConnectivityContextType => {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
};
