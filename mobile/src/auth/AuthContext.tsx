/**
 * AuthContext — single source of truth for the authenticated user.
 *
 * On boot:
 *   1. Check MSAL for a cached account from a previous sign-in
 *   2. If present, prompt biometric → if ok, silently acquire a fresh token
 *   3. Fetch the user profile from /auth/me using that token
 *   4. If any step fails or there's no cached account → show LoginScreen
 *
 * Exposes:
 *   user, isLoading, signIn(), signOut(), reauthenticate()
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMe, signOut as signOutOnServer } from '@api/auth';
import { setAccessToken, clearAccessToken } from './tokens';
import { signInWithEntraId, acquireTokenSilently, signOutEntraId, hasCachedAccount } from './entraId';
import { requireBiometric } from './biometric';
import { AuthUser } from '@types/domain';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reauthenticate: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Boot: try to restore session
  useEffect(() => {
  (async () => {
    console.log('========== AUTH BOOT STARTED ==========');

    try {
      console.log('Step 1: Checking cached account...');
	  const cached = false;
      //const cached = await hasCachedAccount();
      console.log('Cached account:', cached);

      if (!cached) {
        console.log('No cached account found.');
        return;
      }

      console.log('Step 2: Requesting biometric authentication...');
      const ok = await requireBiometric('Unlock Hajery Pulse');
      console.log('Biometric result:', ok);

      if (!ok) {
        console.log('Biometric authentication failed or cancelled.');
        return;
      }

      console.log('Step 3: Acquiring token silently...');
      const session = await acquireTokenSilently();
      console.log('Silent token result:', session);

      if (!session) {
        console.log('No session returned from MSAL.');
        return;
      }

      console.log('Step 4: Saving access token...');
      setAccessToken(session.accessToken, session.expiresOn);

      console.log('Step 5: Calling getMe()...');
      const me = await getMe();

      console.log('User loaded successfully:', me);
      setUser(me);
    } catch (error) {
      console.error('=======================================');
      console.error('AUTH BOOT FAILED');
      console.error(error);
      console.error('=======================================');

      clearAccessToken();
      setUser(null);
    } finally {
      console.log('========== AUTH BOOT FINISHED ==========');
      setIsLoading(false);
    }
  })();
}, []);

  const signOut = useCallback(async () => {
    try {
      await signOutOnServer();
    } catch {
      // Best-effort — don't block local sign-out on a network/API failure.
    }
    await signOutEntraId();
    clearAccessToken();
    setUser(null);
  }, []);

  const reauthenticate = useCallback(async () => {
    return requireBiometric('Confirm to continue');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, reauthenticate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}