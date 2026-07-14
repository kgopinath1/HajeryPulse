import React, { useState } from 'react';
import {
  Text, View, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@auth/AuthContext';
import { theme } from '@theme/index';

export function LoginScreen(): React.JSX.Element {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch (e: any) {
     console.log('SIGN IN ERROR:', e); // TEMP — see the real error
      Alert.alert('Sign-in failed', e.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.brand}>
        <Image
          source={require('@assets/images/MNH Logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={styles.wordmark}>
          <Text style={styles.logo}>Hajery</Text>
          <Text style={styles.logoBold}>PULSE</Text>
        </View>
      </View>

      <Text style={styles.tagline}>Executive Mobile App</Text>
      {/* <Text style={styles.sub}>Sales · Inventory · Approvals</Text> */}
      <Text style={styles.sub}>Sales · FnB · Pharmacy</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={onSignIn} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={theme.colors.bg0} />
          ) : (
            <Text style={styles.btnText}>Sign in with Microsoft</Text>
          )}
        </TouchableOpacity>
        {/* <Text style={styles.hint}>You'll be prompted for FaceID / fingerprint after sign-in.</Text> */}
      </View>

      <Text style={styles.footer}>Hajery Group · v1.0.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: theme.colors.bg0,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  brand: { alignItems: 'center', marginBottom: 20 },
  logoImage: {
    width: 180,
    height: 100,
    marginBottom: 12,
  },
  wordmark: { alignItems: 'center' },
  logo:  {
    fontFamily: theme.fonts.numeric,
    fontSize: 40, fontWeight: '300',
    color: theme.colors.gold, letterSpacing: 4,
  },
  logoBold: {
    fontFamily: theme.fonts.numeric,
    fontSize: 44, fontWeight: '700',
    color: theme.colors.text0, letterSpacing: 8, marginTop: -8,
  },
  tagline: { color: theme.colors.text1, fontSize: 14, marginTop: 18 },
  sub:     { color: theme.colors.text2, fontSize: 11, marginTop: 4, letterSpacing: 1 },
  actions: { width: '100%', marginTop: 60, alignItems: 'center' },
  btn: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: theme.radius.lg,
    width: '100%', alignItems: 'center',
  },
  btnText: {
    color: theme.colors.bg0, fontWeight: '700',
    fontSize: 14, letterSpacing: 0.4,
  },
  hint:   { color: theme.colors.text2, fontSize: 15, marginTop: 12, textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 30,
    color: theme.colors.text3, fontSize: 10, letterSpacing: 0.6,
  },
});