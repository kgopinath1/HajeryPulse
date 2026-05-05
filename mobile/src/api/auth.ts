import { apiClient, post } from './client';
import { AuthSession } from '@types/domain';

export interface AuthExchangeRequest {
  code: string;
  codeVerifier: string;
}

/** Exchange Entra ID auth code for a session. */
export async function exchangeAuthCode(req: AuthExchangeRequest): Promise<AuthSession> {
  return post<AuthSession>('/auth/exchange', req);
}

/** Refresh access token. */
export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  return post<AuthSession>('/auth/refresh', { refreshToken });
}

/** Sign out — revokes refresh token server-side. */
export async function signOut(): Promise<void> {
  await apiClient.post('/auth/signout');
}
