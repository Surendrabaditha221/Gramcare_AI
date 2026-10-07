/**
 * GramCare AI - Centralized API Configuration and Network Resilience Module
 * 
 * Provides a single source of truth for:
 * - API Base URL resolution (local, LAN, mobile devices, production)
 * - Intelligent LAN device bridging (avoids mobile localhost loopback trap)
 * - Typed ApiError classification (Network vs Timeout vs Auth vs Server)
 * - Exponential backoff retry utility for transient network failures
 */

export type ApiErrorKind =
  | 'NETWORK_UNAVAILABLE'
  | 'TIMEOUT'
  | 'AUTH_FAILED'
  | 'TOKEN_EXPIRED'
  | 'VALIDATION_FAILED'
  | 'SERVER_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  public readonly kind: ApiErrorKind;
  public readonly statusCode?: number;
  public readonly detail?: string;

  constructor(message: string, kind: ApiErrorKind, statusCode?: number, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

/**
 * Resolves the backend base URL intelligently:
 * 1. Checks `VITE_API_BASE_URL` environment variable.
 * 2. If running on a mobile device or other computer on the same Wi-Fi LAN
 *    (e.g., accessing frontend via http://192.168.1.x:5173), dynamically translates
 *    "127.0.0.1" / "localhost" to the host's actual IP address so mobile devices
 *    do NOT attempt to connect to their own local loopback.
 * 3. Falls back safely based on development vs production environment.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL?.trim();

  // If explicit environment URL is supplied
  if (envUrl && envUrl !== '') {
    const cleanUrl = envUrl.replace(/\/+$/, '');

    // LAN / Mobile device bridge in development
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const currentHost = window.location.hostname;
      const isCurrentHostRemote = currentHost !== 'localhost' && currentHost !== '127.0.0.1' && currentHost !== '';
      
      // If user is accessing from phone (e.g. 192.168.1.25), replace localhost with PC IP
      if (isCurrentHostRemote && (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1'))) {
        return cleanUrl.replace(/localhost|127\.0\.0\.1/, currentHost);
      }
    }

    return cleanUrl;
  }

  // Development fallback
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const currentHost = window.location.hostname;
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1' && currentHost !== '') {
      return `http://${currentHost}:8000`;
    }
  }

  const isDev = (import.meta as any).env?.DEV;
  if (isDev) {
    return 'http://127.0.0.1:8000';
  }

  // Production fallback: same-origin or dedicated Render/Cloud deployment
  return 'https://gramcare-api.onrender.com';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Build a full API endpoint URL
 */
export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Robust fetch wrapper with timeout and exponential backoff retry.
 * Automatically classifies errors into typed `ApiError` instances.
 */
export async function resilientFetch<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeoutMs = 12000,
    retries = 1,
    retryDelayMs = 1000,
    ...fetchInit
  } = options;

  const url = endpoint.startsWith('http') ? endpoint : buildApiUrl(endpoint);

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Check offline status before firing
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new ApiError(
          'No internet connection detected. Please check your network.',
          'NETWORK_UNAVAILABLE'
        );
      }

      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errData = await response.json();
          errorDetail = errData?.detail || errData?.message || errData?.error || '';
        } catch {
          errorDetail = await response.text().catch(() => '');
        }

        // Categorize HTTP status codes
        if (response.status === 401) {
          throw new ApiError(
            errorDetail || 'Authentication failed. Please verify your credentials.',
            'AUTH_FAILED',
            response.status,
            errorDetail
          );
        } else if (response.status === 403) {
          throw new ApiError(
            errorDetail || 'Access denied for this resource.',
            'AUTH_FAILED',
            response.status,
            errorDetail
          );
        } else if (response.status === 400 || response.status === 422) {
          throw new ApiError(
            errorDetail || 'The request could not be processed. Please check your input.',
            'VALIDATION_FAILED',
            response.status,
            errorDetail
          );
        } else if (response.status === 503 || response.status === 502) {
          throw new ApiError(
            errorDetail || 'GramCare server service is temporarily unavailable. Please try again in a moment.',
            'SERVER_ERROR',
            response.status,
            errorDetail
          );
        } else if (response.status >= 500) {
          throw new ApiError(
            errorDetail || 'An internal server error occurred. Please try again.',
            'SERVER_ERROR',
            response.status,
            errorDetail
          );
        } else {
          throw new ApiError(
            errorDetail || `Request failed with status ${response.status}`,
            'UNKNOWN',
            response.status,
            errorDetail
          );
        }
      }

      // Check if empty response (e.g. 204 No Content)
      const text = await response.text();
      return text ? JSON.parse(text) : (null as any);

    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;

      // Do NOT retry client validation, auth, or explicit HTTP errors
      if (err instanceof ApiError && err.kind !== 'NETWORK_UNAVAILABLE' && err.kind !== 'TIMEOUT') {
        throw err;
      }

      // Check if it was an abort timeout
      if (err.name === 'AbortError') {
        lastError = new ApiError(
          `Connection timed out (${timeoutMs}ms) reaching GramCare backend at ${url}.`,
          'TIMEOUT',
          undefined,
          `Request to ${url} timed out.`
        );
      } else if (!(err instanceof ApiError)) {
        lastError = new ApiError(
          `Unable to reach GramCare backend at ${url}. Please verify the server is running and accessible on your network.`,
          'NETWORK_UNAVAILABLE',
          undefined,
          err?.message || `Failed to connect to ${url}`
        );
      }

      // Dual-path fallback for LAN development:
      // If direct connection to http://<lan_host>:8000 failed due to network/firewall,
      // attempt the Vite dev server proxy endpoint (/api/...) before giving up.
      const isDev = (import.meta as any).env?.DEV;
      if (isDev && !endpoint.startsWith('http') && url.includes(':8000') && typeof window !== 'undefined') {
        try {
          const proxyUrl = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
          const proxyController = new AbortController();
          const proxyTimer = setTimeout(() => proxyController.abort(), Math.min(timeoutMs, 5000));
          const proxyResponse = await fetch(proxyUrl, {
            ...fetchInit,
            signal: proxyController.signal
          });
          clearTimeout(proxyTimer);
          if (proxyResponse.ok) {
            const proxyText = await proxyResponse.text();
            return proxyText ? JSON.parse(proxyText) : (null as any);
          }
        } catch (_) {
          // If proxy fallback also fails, continue with normal retry/error reporting
        }
      }

      attempt++;
      if (attempt <= retries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  throw lastError;
}
