/**
 * AuthContext — single source of truth for the authenticated user.
 *
 * TEMP ISOLATION TEST: MSAL (react-native-msal) import and all calls have
 * been fully removed to isolate whether MSAL's native iOS module is the
 * cause of the "RCTEventEmitter.receiveEvent() Module has not been
 * registered as callable" crash seen on iOS/Appetize.
 *
 * Original boot flow (restore once isolation test is complete):
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
// TEMP: fully removed to isolate MSAL native module load as suspected crash cause
// import { signInWithEntraId, acquireTokenSilently, signOutEntraId, hasCachedAccount } from './entraId';
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
    // TEMP ISOLATION: skipping MSAL boot sequence entirely — no MSAL code
    // runs or is even imported at this point.
    console.log('TEMP ISOLATION: MSAL import removed, skipping boot sequence');
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async () => {
    // TEMP: MSAL removed for isolation test — this will not actually sign in.
    console.log('TEMP ISOLATION: signIn stubbed, MSAL not available in this build');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutOnServer();
    } catch {
      // Best-effort — don't block local sign-out on a network/API failure.
    }
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