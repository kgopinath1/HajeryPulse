/**
 * AuthContext — single source of truth for the authenticated user.
 *
 * On boot:
 *   1. Check MSAL for a cached account from a previous sign-in
 *   2. If present, prompt biometric → if ok, silently acquire a fresh token
 *   3. Fetch the user profile from /auth/me using that token
 *   4. If any step fails or there's no cached account → show LoginScreen
 *
 * After every sign-in this account's device key is loaded. If the API says
 * the device isn't activated (first install, reinstall, new phone) or was
 * revoked, `activationRequired` is set and the activation screen asks for a
 * code from IT — the Microsoft session is kept, so no second sign-in.
 *
 * Exposes:
 *   user, isLoading, activationRequired, signIn(), signOut(), activate(),
 *   reauthenticate()
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { getMe, signOut as signOutOnServer } from '@api/auth';
import { activateDevice } from '@api/device';
import { ApiError, DeviceActivationReason, setDeviceActivationHandler } from '@api/client';
import { setAccessToken, clearAccessToken } from './tokens';
import { signInWithEntraId, acquireTokenSilently, signOutEntraId, hasCachedAccount, EntraIdSession } from './entraId';
import { loadDeviceKey, saveDeviceKey, clearDeviceKey } from './deviceKey';
import { requireBiometric } from './biometric';
import { isRuntimeCompromised } from './emulatorGuard';
import { AuthUser } from '@domain';

// How long the app can sit backgrounded before returning requires a fresh
// biometric unlock. Bounds how long a signed-in session survives on a
// device left unattended, independent of how long the underlying MSAL
// token itself stays valid.
const INACTIVITY_LOCK_MS = 5 * 60 * 1000;

/** Signed in with Microsoft, but this device still needs an activation code. */
export interface ActivationRequired {
  reason: DeviceActivationReason;
  /** The Microsoft account signed in, so a shared phone shows whose code is needed. */
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  blocked: boolean;
  locked: boolean;
  activationRequired: ActivationRequired | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Redeems an activation code from IT. Rejects with the API's ApiError (message is user-facing). */
  activate: (code: string) => Promise<void>;
  reauthenticate: () => Promise<boolean>;
  unlock: () => Promise<boolean>;
}

function isDeviceActivationError(e: unknown): e is ApiError & { code: DeviceActivationReason } {
  const code = (e as ApiError | null)?.code;
  return code === 'DEVICE_NOT_ACTIVATED' || code === 'DEVICE_REVOKED';
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const [activationRequired, setActivationRequired] = useState<ActivationRequired | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  const usernameRef = useRef<string>('');

  // Any API call can find the device revoked mid-session (activated on
  // another phone, or turned off by IT) — switch to the activation screen.
  useEffect(() => {
    setDeviceActivationHandler(reason => {
      if (reason === 'DEVICE_REVOKED') clearDeviceKey();
      setActivationRequired({ reason, username: usernameRef.current });
    });
    return () => setDeviceActivationHandler(null);
  }, []);

  // Shared by boot restore and interactive sign-in. Resolves once the user
  // is in, or once the activation screen is needed; other errors propagate.
  const completeSignIn = useCallback(async (session: EntraIdSession) => {
    setAccessToken(session.accessToken, session.expiresOn);
    usernameRef.current = session.account.username;
    await loadDeviceKey(session.account.identifier);
    try {
      const me = await getMe();
      setUser(me);
      setActivationRequired(null);
    } catch (e) {
      if (isDeviceActivationError(e)) return; // handler above has shown the activation screen
      throw e;
    }
  }, []);

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

        try {
          await completeSignIn(session);
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
      await completeSignIn(session);
    } finally {
      setIsLoading(false);
    }
  }, [completeSignIn]);

  const activate = useCallback(async (code: string) => {
    const deviceKey = await activateDevice(code);
    await saveDeviceKey(deviceKey);
    const me = await getMe();
    setUser(me);
    setActivationRequired(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutOnServer();
    } catch {
      // Best-effort — don't block local sign-out on a network/API failure.
    }
    // The device key stays, so the same user signing back in on this phone
    // doesn't need a new code.
    await signOutEntraId();
    clearAccessToken();
    setUser(null);
    setLocked(false);
    setActivationRequired(null);
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
    <AuthContext.Provider value={{ user, isLoading, blocked, locked, activationRequired, signIn, signOut, activate, reauthenticate, unlock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}