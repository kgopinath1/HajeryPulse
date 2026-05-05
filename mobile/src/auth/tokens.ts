/**
 * Token storage. Refresh token lives in the device secure enclave (Keychain/Keystore).
 * Access token is held in memory only — never written to disk.
 */
import * as Keychain from 'react-native-keychain';
import { refreshSession } from '@api/auth';

const SERVICE = 'com.hajerygroup.pulse.refresh';

let inMemoryAccessToken: string | null = null;
let inMemoryExpiresAt: number = 0;

export async function getStoredAccessToken(): Promise<string | null> {
  if (inMemoryAccessToken && Date.now() < inMemoryExpiresAt - 30_000) {
    return inMemoryAccessToken;
  }
  // Token expired or missing — caller (axios interceptor) will trigger a refresh.
  return inMemoryAccessToken;
}

export function setAccessToken(token: string, expiresAtIso: string): void {
  inMemoryAccessToken = token;
  inMemoryExpiresAt = new Date(expiresAtIso).getTime();
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
  inMemoryExpiresAt = 0;
}

export async function storeRefreshToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('hajery-pulse', token, {
    service: SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({ service: SERVICE });
  return creds ? creds.password : null;
}

export async function clearRefreshToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}

/** Called by axios interceptor when a 401 fires. */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const rt = await getStoredRefreshToken();
    if (!rt) return null;
    const session = await refreshSession(rt);
    setAccessToken(session.accessToken, session.expiresAt);
    if (session.refreshToken && session.refreshToken !== rt) {
      await storeRefreshToken(session.refreshToken);
    }
    return session.accessToken;
  } catch {
    // Refresh failed — caller should sign the user out
    clearAccessToken();
    return null;
  }
}
