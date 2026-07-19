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
    // TEMP: isolating MSAL as suspected crash cause — bypassing boot auth entirely
    console.log('TEMP ISOLATION: skipping MSAL boot sequence');
    setIsLoading(false);
    return;

    /* ORIGINAL — restore after isolation test
    (async () => {
      const cached = await hasCachedAccount();
      if (!cached) {
        setIsLoading(false);
        return;
      }

      const ok = await requireBiometric('Unlock Hajery Pulse');
      if (!ok) {
        setIsLoading(false);
        return;
      }

      const session = await acquireTokenSilently();
      if (!session) {
        setIsLoading(false);
        return;
      }

      setAccessToken(session.accessToken, session.expiresOn);
      try {
        const me = await getMe();
        setUser(me);
      } catch {
        clearAccessToken();
        setUser(null);
      }
      setIsLoading(false);
    })();
    */
  }, []);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await signInWithEntraId();
      setAccessToken(session.accessToken, session.expiresOn);
      const me = await getMe();
      setUser(me);
    } finally {
      setIsLoading(false);
    }
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