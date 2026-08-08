import { useConnectivity } from '../context/ConnectivityContext';

export function useOnlineStatus() {
  const connectivity = useConnectivity();

  return {
    status: connectivity.status,
    internetStatus: connectivity.internetStatus,
    backendStatus: connectivity.backendStatus,
    isOnline: connectivity.isOnline,
    isBackendAvailable: connectivity.isBackendAvailable,
    isAiServiceAvailable: connectivity.isAiServiceAvailable,
    isBackendChecking: connectivity.isBackendChecking,
    rawBrowserOnline: connectivity.rawBrowserOnline,
    retryCount: connectivity.retryCount,
    lastCheckedAt: connectivity.lastCheckedAt,
    showReconnectedToast: connectivity.showReconnectedToast,
    showOfflineToast: connectivity.showOfflineToast,
    showServiceUnavailableToast: connectivity.showServiceUnavailableToast,
    dismissToast: connectivity.dismissToasts,
    checkHealthNow: connectivity.checkHealthNow,
    canUseFeature: connectivity.canUseFeature
  };
}
