import { apiClient, get } from './client';
import { AuthUser } from '@types/domain';

/**
 * Fetch the signed-in user's profile. The API derives this from the
 * validated Entra ID token's claims — see AuthController's /me endpoint.
 */
export async function getMe(): Promise<AuthUser> {
  return get<AuthUser>('/auth/me');
}

/**
 * Sign out — lets the API log the event for audit purposes. Actual
 * session teardown (clearing MSAL's cached account) happens on-device
 * via signOutEntraId(), called separately by AuthContext.
 */
export async function signOut(): Promise<void> {
  await apiClient.post('/auth/signout');
}