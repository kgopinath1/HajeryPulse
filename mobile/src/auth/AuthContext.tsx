/**
 * AuthContext — single source of truth for the authenticated user.
 *
 * On boot:
 *   1. Check for a stored refresh token in Keychain
 *   2. If present, prompt biometric → if ok, exchange refresh for access token
 *   3. If absent or biometric failed → show LoginScreen
 *
 * Exposes:
 *   user, isLoading, signIn(), signOut(), reauthenticate()
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { exchangeAuthCode } from '@api/auth';
import {
  setAccessToken, clearAccessToken,
  storeRefreshToken, getStoredRefreshToken, clearRefreshToken,
  refreshAccessToken,
} from './tokens';
import { startEntraIdSignIn } from './entraId';
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
      const rt = await getStoredRefreshToken();
      if (!rt) {
        setIsLoading(false);
        return;
      }
      const ok = await requireBiometric('Unlock Hajery Pulse');
      if (!ok) {
        setIsLoading(false);
        return;
      }
      const newToken = await refreshAccessToken();
      if (newToken) {
        // The user payload comes back from refreshSession in production —
        // for now we rely on a /me endpoint or the session payload from refresh.
        // Keeping the structure flexible until that's wired.
        setUser({
          id: 'restored', name: 'Executive User',
          email: 'user@hajerygroup.com', roles: ['ceo'], scopedBuCodes: [],
        });
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const { code, codeVerifier } = await startEntraIdSignIn();
      const session = await exchangeAuthCode({ code, codeVerifier });
      setAccessToken(session.accessToken, session.expiresAt);
      await storeRefreshToken(session.refreshToken);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    clearAccessToken();
    await clearRefreshToken();
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
