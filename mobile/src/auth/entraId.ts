/**
 * Entra ID (Azure AD) authentication via MSAL — real implementation.
 *
 * Uses react-native-msal, which wraps Microsoft's native MSAL SDKs on iOS/Android.
 * MSAL handles the full PKCE flow, the system browser hop, and its own secure
 * token cache — we don't hand-roll any of that here.
 *
 * Native setup required (not covered by this file alone):
 *   iOS:     add the redirect URI scheme to Info.plist's CFBundleURLTypes
 *   Android: add an intent-filter for the redirect URI in AndroidManifest.xml
 *            pointing at MSAL's BrowserTabActivity
 * See react-native-msal's setup docs for the exact native config — this JS
 * file alone will not work until that's done.
 */
import { Platform } from 'react-native';
import PublicClientApplication from 'react-native-msal';
import type { MSALConfiguration, MSALResult, MSALAccount } from 'react-native-msal';

const TENANT_ID = 'd1370f20-ac1a-4583-8b5e-f3022a041a2c';
const CLIENT_ID = 'b6487636-354c-483e-94a4-e408271e36b2';

// Must match the scope exposed under "Expose an API" in Azure.
const API_SCOPE = 'api://b6487636-354c-483e-94a4-e408271e36b2/HajeryPulse';

// TODO: iOS redirect URI still needed — depends on iOS bundle identifier,
// format is typically msauth.<bundle-id>://auth. Android value confirmed
// from the debug keystore signature hash.
const REDIRECT_URI = Platform.select({
  android: 'msauth://com.hajerypulse/Xo8WBi6jzSxKDVR4drqm84yr9iU%3D',
  ios: 'msauth://com.hajerypulse/Xo8WBi6jzSxKDVR4drqm84yr9iU%3D', // TODO: fill in once iOS bundle ID + redirect URI are set up in Azure
});

const msalConfig: MSALConfiguration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
  },
};

export interface EntraIdSession {
  accessToken: string;
  expiresOn: Date | null;
  account: MSALAccount;
}

let pcaInstance: PublicClientApplication | null = null;

/** Lazily creates + initializes the MSAL client. Safe to call repeatedly. */
async function getClient(): Promise<PublicClientApplication> {
  if (!pcaInstance) {
    try {
      console.log('Creating MSAL client...');
      console.log('Platform:', Platform.OS);
      console.log('Redirect URI:', REDIRECT_URI);

      const client = new PublicClientApplication(msalConfig);

      console.log('Initializing MSAL...');
      await client.init();

      console.log('MSAL initialized.');

      pcaInstance = client;
    } catch (e) {
      console.error('MSAL initialization failed:', e);
      throw e;
    }
  }

  return pcaInstance;
}

function toSession(result: MSALResult): EntraIdSession {
  // NOTE: confirm whether expiresOn is seconds or milliseconds on your
  // installed native SDK version before relying on this in production —
  // if the resulting Date looks wrong (e.g. year 1970 or absurdly far out),
  // multiply/divide by 1000 accordingly.
  return {
    accessToken: result.accessToken,
    expiresOn: result.expiresOn ? new Date(result.expiresOn) : null,
    account: result.account,
  };
}

/**
 * Interactive sign-in — opens the system browser to Entra ID's hosted login
 * page (which handles username/password, MFA, or federated on-prem Windows
 * auth automatically depending on tenant config). Returns a real Entra ID
 * access token scoped to the API — no custom code/verifier exchange needed.
 */
export async function signInWithEntraId(): Promise<EntraIdSession> {
  const client = await getClient();
  const result = await client.acquireToken({ scopes: [API_SCOPE] });
  if (!result) {
    throw new Error('Entra ID sign-in was cancelled or failed');
  }
  return toSession(result);
}

/**
 * Silent token acquisition using MSAL's cached account/session — used on
 * app boot to restore a session without prompting the user to sign in again.
 * Returns null if there's no cached account (i.e. user needs to sign in).
 */
export async function acquireTokenSilently(): Promise<EntraIdSession | null> {
  const client = await getClient();
  const accounts = await client.getAccounts();
  const account = accounts[0];
  if (!account) return null;

  try {
    const result = await client.acquireTokenSilent({
      scopes: [API_SCOPE],
      account,
    });
    return result ? toSession(result) : null;
  } catch {
    // Silent acquisition can fail if the cached session needs re-auth
    // (revoked, expired refresh, conditional access changes, etc.)
    return null;
  }
}

/** Signs out and clears MSAL's cached account. */
export async function signOutEntraId(): Promise<void> {
  const client = await getClient();
  const accounts = await client.getAccounts();
  const account = accounts[0];
  if (!account) return;
  await client.signOut({ account });
}

/** Returns true if MSAL has a cached account from a previous sign-in. */
export async function hasCachedAccount(): Promise<boolean> {
  const client = await getClient();
  const accounts = await client.getAccounts();
  return accounts.length > 0;
}