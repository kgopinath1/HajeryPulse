/**
 * Access token holder. MSAL owns the actual refresh-token cache internally
 * (encrypted, on-device) — this file no longer manages that directly. It
 * just holds the current access token in memory for the axios interceptor
 * to attach to outgoing requests, refreshed via entraId.ts's
 * acquireTokenSilently() when needed.
 */

let inMemoryAccessToken: string | null = null;
let inMemoryExpiresAt: number = 0;

export function getStoredAccessToken(): string | null {
  if (inMemoryAccessToken && Date.now() < inMemoryExpiresAt - 30_000) {
    return inMemoryAccessToken;
  }
  // Token expired or missing — caller (axios interceptor) should call
  // acquireTokenSilently() from entraId.ts to get a fresh one.
  return null;
}

export function setAccessToken(token: string, expiresOn: Date | null): void {
  inMemoryAccessToken = token;
  inMemoryExpiresAt = expiresOn ? expiresOn.getTime() : 0;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
  inMemoryExpiresAt = 0;
}