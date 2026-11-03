import React, { useState } from 'react';
import {
  Text, View, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '@auth/AuthContext';
import { ApiError } from '@api/client';
import { theme } from '@theme/index';

const TOKEN_LENGTH = 8;

/** Keeps letters/digits only, upper-cased, as "XXXX-XXXX". */
function formatToken(input: string): string {
  const chars = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TOKEN_LENGTH);
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e && 'status' in e;
}

function errorMessage(e: unknown): string {
  // DeviceController's messages are written for the user.
  return isApiError(e) && e.status > 0 ? e.message : "Couldn't reach Hajery Pulse. Check your connection and try again.";
}

/**
 * Shown after Microsoft sign-in when this device has no token for the user
 * yet (new phone, or the token was wiped by an Android reinstall) or IT
 * turned it off. "Get token" emails IT, who send the user a token (to be
 * entered within 2 hours). After a reinstall the same token works again.
 */
export function ActivationScreen(): React.JSX.Element {
  const { activationRequired, requestToken, activate, signOut } = useAuth();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'request' | 'activate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = activationRequired?.device.state ?? 'none';
  const otherDevices = activationRequired?.device.activeDevices ?? 0;
  const known = state === 'known';
  const showTokenEntry = state === 'requested' || state === 'issued' || known;
  const complete = token.replace('-', '').length === TOKEN_LENGTH;

  const onRequest = async () => {
    setBusy('request');
    setError(null);
    try {
      await requestToken();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onActivate = async () => {
    setBusy('activate');
    setError(null);
    try {
      await activate(token);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  let icon = 'key-outline';
  let title = 'Activate this device';
  let text = 'Tap "Get token" to ask IT for a token for this device. You only need to do this once.';
  if (state === 'revoked') {
    icon = 'phone-portrait-outline';
    title = 'Device turned off';
    text = 'IT has turned off Hajery Pulse on this device. Tap "Get token" to ask for a new token.';
  } else if (known) {
    icon = 'key-outline';
    title = 'Enter your token';
    text = 'This device is already set up for you. Enter the token shared by IT.';
  } else if (showTokenEntry) {
    icon = 'mail-unread-outline';
    title = 'Enter your token';
    text = 'Your request has been sent to IT. Enter the token they give you within 2 hours.';
  } else if (otherDevices > 0) {
    icon = 'phone-portrait-outline';
    title = 'New device';
    text = `Hajery Pulse is already set up on ${otherDevices === 1 ? 'another device' : `${otherDevices} other devices`}. To use it on this device as well, ask IT for a token.`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Ionicons name={icon} size={44} color={theme.colors.gold} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        {!!activationRequired?.username && (
          <Text style={styles.account}>Signed in as {activationRequired.username}</Text>
        )}

        {activationRequired?.itNotified === false && (
          <Text style={styles.warning}>
            Your request was saved, but IT couldn't be notified automatically. Please contact IT.
          </Text>
        )}

        {showTokenEntry ? (
          <>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={token}
              onChangeText={t => { setToken(formatToken(t)); setError(null); }}
              placeholder="XXXX-XXXX"
              placeholderTextColor={theme.colors.text3}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              maxLength={TOKEN_LENGTH + 1}
              returnKeyType="done"
              onSubmitEditing={() => complete && !busy && onActivate()}
              editable={!busy}
              accessibilityLabel="Token"
            />
            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, (!complete || !!busy) && styles.btnDisabled]}
              onPress={onActivate}
              disabled={!complete || !!busy}
            >
              {busy === 'activate' ? (
                <ActivityIndicator color={theme.colors.bg0} />
              ) : (
                <Text style={styles.btnText}>Activate</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onRequest} style={styles.link} disabled={!!busy}>
              {busy === 'request' ? (
                <ActivityIndicator color={theme.colors.text2} />
              ) : (
                <Text style={styles.linkText}>
                  {known ? "Don't have it? Get a new token" : 'Token expired or not received? Ask again'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={[styles.btn, !!busy && styles.btnDisabled]} onPress={onRequest} disabled={!!busy}>
              {busy === 'request' ? (
                <ActivityIndicator color={theme.colors.bg0} />
              ) : (
                <Text style={styles.btnText}>{otherDevices > 0 && state !== 'revoked' ? 'Get token for this device' : 'Get token'}</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={signOut} style={styles.signOut} disabled={!!busy}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg0 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: theme.colors.text0, fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  text: { color: theme.colors.text1, fontSize: 14, lineHeight: 20, marginTop: 10, textAlign: 'center' },
  account: { color: theme.colors.text2, fontSize: 12, marginTop: 12, textAlign: 'center' },
  warning: { color: theme.colors.gold, fontSize: 13, lineHeight: 18, marginTop: 16, textAlign: 'center' },
  input: {
    width: '100%', marginTop: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.borderHi, borderRadius: theme.radius.lg,
    paddingVertical: 14, paddingHorizontal: 16,
    color: theme.colors.text0, fontSize: 24, fontWeight: '600', letterSpacing: 4, textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  inputError: { borderColor: theme.colors.red },
  error: { color: theme.colors.red, fontSize: 13, marginTop: 10, textAlign: 'center' },
  btn: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: theme.radius.lg,
    width: '100%', alignItems: 'center', marginTop: 20,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: theme.colors.bg0, fontWeight: '700', fontSize: 14, letterSpacing: 0.4 },
  link: { marginTop: 16, padding: 8, minHeight: 36, justifyContent: 'center' },
  linkText: { color: theme.colors.text2, fontSize: 13, textAlign: 'center' },
  signOut: { marginTop: 24, padding: 8 },
  signOutText: { color: theme.colors.text2, fontSize: 13 },
});
