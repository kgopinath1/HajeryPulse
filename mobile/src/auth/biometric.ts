/**
 * Biometric (FaceID / TouchID / Fingerprint) gate for unlocking the app.
 *
 * Stubbed implementation: react-native-biometrics provides the actual prompt
 * on iOS and Android. We surface a single `requireBiometric()` call that
 * resolves true if authentication succeeds, false if the user cancels or fails.
 */
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true, // fall back to device passcode if biometrics unavailable
});

export async function isBiometricAvailable(): Promise<{
  available: boolean;
  type: 'FaceID' | 'TouchID' | 'Fingerprint' | 'Face' | 'Iris' | null;
}> {
  const { available, biometryType } = await rnBiometrics.isSensorAvailable();
  if (!available) return { available: false, type: null };
  switch (biometryType) {
    case BiometryTypes.FaceID:      return { available: true, type: 'FaceID' };
    case BiometryTypes.TouchID:     return { available: true, type: 'TouchID' };
    case BiometryTypes.Biometrics:  return { available: true, type: 'Fingerprint' };
    default:                         return { available: true, type: 'Fingerprint' };
  }
}

export async function requireBiometric(reason = 'Authenticate to continue'): Promise<boolean> {
  try {
    const { success } = await rnBiometrics.simplePrompt({ promptMessage: reason });
    return success;
  } catch {
    return false;
  }
}
