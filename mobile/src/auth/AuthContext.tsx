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
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { getMe, signOut as signOutOnServer } from '@api/auth';
import { setAccessToken, clearAccessToken } from './tokens';
import { signInWithEntraId, acquireTokenSilently, signOutEntraId, hasCachedAccount } from './entraId';
import { requireBiometric } from './biometric';
import { isRuntimeCompromised } from './emulatorGuard';
import { AuthUser } from '@domain';

// How long the app can sit backgrounded before returning requires a fresh
// biometric unlock. Bounds how long a signed-in session survives on a
// device left unattended, independent of how long the underlying MSAL
// token itself stays valid.
const INACTIVITY_LOCK_MS = 5 * 60 * 1000;

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  blocked: boolean;
  locked: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reauthenticate: () => Promise<boolean>;
  unlock: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const backgroundedAtRef = useRef<number | null>(null);

  // Boot: try to restore session
  useEffect(() => {
    (async () => {
      try {
        if (await isRuntimeCompromised()) {
          setBlocked(true);
          return;
        }

        const cached = await hasCachedAccount();
        if (!cached) {
          return;
        }

        const ok = await requireBiometric('Unlock Hajery Pulse');
        if (!ok) {
          return;
        }

        const session = await acquireTokenSilently();
        if (!session) {
          return;
        }

        setAccessToken(session.accessToken, session.expiresOn);
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          // MSAL had a valid cached session but the API rejected/errored —
          // treat as signed out rather than showing a broken authenticated state.
          clearAccessToken();
          setUser(null);
        }
      } catch (err) {
        // Without this, a thrown error (e.g. MSAL native init failing) would
        // leave isLoading stuck true forever — infinite spinner, no login
        // screen, no crash report. Logged in full for diagnosis; the alert
        // itself stays generic in release builds so a native/internal error
        // message is never shown to the end user.
        console.error('[HajeryPulse] Startup error:', err);
        Alert.alert(
          'Startup error',
          __DEV__ ? String(err) : 'Something went wrong while starting the app. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // MASTG-BEST-0047 — continuous checking. The boot check above only ever
  // runs once at launch; this catches an emulator swap or Frida/Xposed
  // attaching mid-session instead of only at startup. Sticky once tripped —
  // never resets blocked back to false on its own.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (await isRuntimeCompromised()) {
        setBlocked(true);
      }
    }, 20_000);
    return () => clearInterval(interval);
  }, []);

  // Re-lock after the app has spent long enough backgrounded — a phone left
  // unlocked and unattended shouldn't stay signed in indefinitely just
  // because the underlying MSAL token hasn't expired yet.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'background') {
        if (user) backgroundedAtRef.current = Date.now();
        return;
      }
      if (state === 'active' && backgroundedAtRef.current != null) {
        const elapsed = Date.now() - backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (user && elapsed > INACTIVITY_LOCK_MS) {
          setLocked(true);
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [user]);

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
    setLocked(false);
  }, []);

  const reauthenticate = useCallback(async () => {
    return requireBiometric('Confirm to continue');
  }, []);

  const unlock = useCallback(async () => {
    const ok = await requireBiometric('Unlock Hajery Pulse');
    if (ok) setLocked(false);
    return ok;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, blocked, locked, signIn, signOut, reauthenticate, unlock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}