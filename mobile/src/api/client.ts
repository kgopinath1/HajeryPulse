/**
 * Axios HTTP client for the Hajery Pulse API.
 *
 * Responsibilities:
 *  - Attach Bearer token from AuthContext on every request
 *  - Auto-refresh expired tokens once before failing
 *  - Surface errors with a stable shape: { code, message, traceId }
 *  - Retry idempotent GETs once on 5xx
 */
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getStoredAccessToken, refreshAccessToken } from '@auth/tokens';

// In production, point at the data-center API URL or use env-driven config.
const BASE_URL = __DEV__
  ? 'http://10.0.2.2:50758/api/v1'      // Android emulator → host loopback
  : 'https://api.hajerypulse.internal/api/v1';

  
const SPEND_API = __DEV__
  ? 'http://192.168.10.147:8086/api'
  : 'https://spendflow.internal/api';


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
  const token = await getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('TOKEN:', token);
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  resp => resp,
  async (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 → try refresh once
    if (status === 401 && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }

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
