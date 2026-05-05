/**
 * Entra ID (Azure AD) OAuth 2.0 + PKCE flow — STUBBED.
 *
 * In production: open ASWebAuthenticationSession (iOS) / Custom Tabs (Android)
 * pointing at Entra ID's authorization endpoint, capture the redirect, and
 * exchange the code via /api/v1/auth/exchange.
 *
 * For development the stub bypasses the browser hop and returns a fake auth
 * code that the dev API accepts. Set ENTRA_ID_TENANT_ID + CLIENT_ID below.
 *
 * Replace this with `@azure/msal-react-native` (preview) or
 * `react-native-app-auth` for the real implementation.
 */
import InAppBrowser from 'react-native-inappbrowser-reborn';

export const ENTRA_ID_CONFIG = {
  tenantId:    'YOUR_TENANT_ID',          // TODO: fill in for production
  clientId:    'YOUR_CLIENT_ID',          // TODO: fill in for production
  redirectUri: 'hajerypulse://auth/callback',
  scopes:      ['openid', 'profile', 'email', 'api://hajerypulse-api/.default'],
};

export interface EntraIdAuthResult {
  code: string;
  codeVerifier: string;
}

/** Generates a PKCE verifier/challenge pair. */
function pkce(): { verifier: string; challenge: string } {
  // In a real impl, use crypto-strong randomness + SHA-256 hash.
  // Stubbed for skeleton; replace with `react-native-get-random-values` + SubtleCrypto polyfill.
  const verifier = 'stub-verifier-' + Date.now();
  const challenge = 'stub-challenge-' + Date.now();
  return { verifier, challenge };
}

export async function startEntraIdSignIn(): Promise<EntraIdAuthResult> {
  const { verifier, challenge } = pkce();

  // -- DEV STUB --
  if (__DEV__ && ENTRA_ID_CONFIG.tenantId === 'YOUR_TENANT_ID') {
    return { code: 'dev-stub-code', codeVerifier: verifier };
  }

  // -- PRODUCTION FLOW --
  const authUrl =
    `https://login.microsoftonline.com/${ENTRA_ID_CONFIG.tenantId}/oauth2/v2.0/authorize` +
    `?client_id=${ENTRA_ID_CONFIG.clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(ENTRA_ID_CONFIG.redirectUri)}` +
    `&scope=${encodeURIComponent(ENTRA_ID_CONFIG.scopes.join(' '))}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256`;

  if (await InAppBrowser.isAvailable()) {
    const result = await InAppBrowser.openAuth(authUrl, ENTRA_ID_CONFIG.redirectUri, {
      ephemeralWebSession: false,
      showTitle: false,
    });
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (code) return { code, codeVerifier: verifier };
    }
  }
  throw new Error('Entra ID sign-in cancelled or failed');
}
