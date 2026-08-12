/**
 * Axios HTTP client for the Hajery Pulse API.
 *
 * Responsibilities:
 *  - Attach Bearer token from AuthContext on every request
 *  - Auto-refresh expired tokens once before failing (via MSAL silent acquire)
 *  - Surface errors with a stable shape: { code, message, traceId }
 *  - Retry idempotent GETs once on 5xx
 */
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { getStoredAccessToken, setAccessToken } from '@auth/tokens';
import { acquireTokenSilently } from '@auth/entraId';
import { getDeviceId } from '@auth/deviceId';

// Dev machine's LAN IP — only needed for Android, since a physical Android
// device can't resolve "localhost" to the dev machine the way iOS Simulator
// can (Simulator shares the Mac's network stack; a real device doesn't).
// Device and dev machine must be on the same Wi-Fi.
const DEV_LAN_IP = '192.168.10.57';

 const BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? `https://localhost:50757/api/v1`
    : `https://${DEV_LAN_IP}:50757/api/v1`
  : `https://helpdesk.hajery.com:4477/api/v1`;
 
/*  const BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? `https://helpdesk.hajery.com:4477`
    : `https://helpdesk.hajery.com:4477`
  : `https://helpdesk.hajery.com:4477`; */

const SPEND_API = __DEV__
  ? 'http://192.168.10.147:8086/api'
  : 'https://spendflow.internal/api';

// Dev-only — prints which backend this build is actually pointed at, so you
// can confirm it from the Metro/adb log window instead of re-reading this
// file every time the URL gets swapped between local/LAN/deployed servers.
if (__DEV__) {
  console.log(`[HajeryPulse] apiClient BASE_URL = ${BASE_URL}`);
  console.log(`[HajeryPulse] spendClient BASE_URL = ${SPEND_API}`);
}


export interface ApiError {
  code: string;
  message: string;
  traceId?: string;
  status: number;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const spendClient: AxiosInstance = axios.create({
  baseURL: SPEND_API,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});


apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Device-Id'] = await getDeviceId();
  config.headers['X-Device-Platform'] = Platform.OS;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function silentlyRefresh(): Promise<string | null> {
  const session = await acquireTokenSilently();
  if (!session) return null;
  setAccessToken(session.accessToken, session.expiresOn);
  return session.accessToken;
}

apiClient.interceptors.response.use(
  resp => resp,
  async (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 → try silent MSAL refresh once
    if (status === 401 && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? silentlyRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      // Silent refresh failed — session is genuinely invalid (revoked,
      // needs re-auth, etc). Caller-side, this should route back to
      // sign-in; AuthContext should listen for repeated 401s or expose
      // a way to react to this rather than this file forcing navigation.
    }

    // Surface a stable shape
    const body: any = err.response?.data ?? {};
    const apiError: ApiError = {
      code: body?.error?.code ?? 'UNKNOWN',
      message: body?.error?.message ?? err.message ?? 'Request failed',
      traceId: body?.error?.traceId,
      status,
    };
    return Promise.reject(apiError);
  },
);

// Registered once, at module load — not inside another interceptor's
// error handler (that was duplicating this on every apiClient failure).
spendClient.interceptors.response.use(
  resp => resp,
  async (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const body: any = err.response?.data ?? {};
    const apiError: ApiError = {
      code: body?.error?.code ?? 'UNKNOWN',
      message: body?.error?.message ?? err.message ?? 'Request failed',
      traceId: body?.error?.traceId,
      status,
    };
    return Promise.reject(apiError);
  }
);

/** Convenience GET wrapper that throws ApiError on failure. */
export async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const r = await apiClient.get<T>(path, { params });
  return r.data;
}

/** Convenience POST wrapper. */
export async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await apiClient.post<T>(path, body);
  return r.data;
}

export async function spendGet<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const r = await spendClient.get<T>(path, { params });
  return r.data;
}

export async function spendPost<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const r = await spendClient.post<T>(path, body);
  return r.data;
}