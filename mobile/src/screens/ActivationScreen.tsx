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

const CODE_LENGTH = 8;

/** Keeps letters/digits only, upper-cased, as "XXXX-XXXX". */
function formatCode(input: string): string {
  const chars = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e && 'status' in e;
}

/**
 * Shown after Microsoft sign-in when this device isn't activated for the
 * user yet (first install, reinstall, new phone) or was revoked. The code
 * comes from IT and works once, for this user only.
 */
export function ActivationScreen(): React.JSX.Element {
  const { activationRequired, activate, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = code.replace('-', '').length === CODE_LENGTH;
  const revoked = activationRequired?.reason === 'DEVICE_REVOKED';

  const onActivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await activate(code);
    } catch (e) {
      // DeviceController's messages are written for the user.
      setError(isApiError(e) && e.status > 0 ? e.message : "Couldn't reach Hajery Pulse. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Ionicons name={revoked ? 'phone-portrait-outline' : 'key-outline'} size={44} color={theme.colors.gold} />
        <Text style={styles.title}>{revoked ? 'Activate this device again' : 'Activate this device'}</Text>
        <Text style={styles.text}>
          {revoked
            ? 'Hajery Pulse was activated on another device, or turned off on this one by IT. Enter a new activation code from IT to use it here.'
            : 'Enter the activation code from IT. You only need to do this once on this device.'}
        </Text>
        {!!activationRequired?.username && (
          <Text style={styles.account}>Signed in as {activationRequired.username}</Text>
        )}

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={code}
          onChangeText={t => { setCode(formatCode(t)); setError(null); }}
          placeholder="XXXX-XXXX"
          placeholderTextColor={theme.colors.text3}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={CODE_LENGTH + 1}
          returnKeyType="done"
          onSubmitEditing={() => complete && !busy && onActivate()}
          editable={!busy}
          accessibilityLabel="Activation code"
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btn, (!complete || busy) && styles.btnDisabled]}
          onPress={onActivate}
          disabled={!complete || busy}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.bg0} />
          ) : (
            <Text style={styles.btnText}>Activate</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>Codes are valid for 48 hours and can be used once.</Text>

        <TouchableOpacity onPress={signOut} style={styles.signOut} disabled={busy}>
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
  hint: { color: theme.colors.text2, fontSize: 12, marginTop: 14, textAlign: 'center' },
  signOut: { marginTop: 24, padding: 8 },
  signOutText: { color: theme.colors.text2, fontSize: 13 },
});
