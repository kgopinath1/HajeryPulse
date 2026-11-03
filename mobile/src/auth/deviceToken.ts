/**
 * This device's ID and token, sent as X-Device-Id / X-Device-Token on every
 * API request.
 *
 * The device ID is the phone's own: iOS identifierForVendor (which
 * react-native-device-info also keeps in the Keychain) or Android
 * ANDROID_ID. Both stay the same after a reinstall, so the API still knows
 * the device. "Get token" sends it to the API, which emails IT; IT issues a
 * token, the user enters it, and from then on both are checked on every
 * request (see DeviceTokenService on the API side).
 *
 * The token is kept in the Keychain (iOS) / Keystore-backed storage
 * (Android), one entry per signed-in account. The iOS Keychain survives a
 * reinstall, so the app keeps working straight away. Android wipes it on
 * uninstall; the API then reports the device as known and the user enters
 * the same token again. THIS_DEVICE_ONLY stops it travelling to a new phone
 * in a backup.
 */
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';

const SERVICE_PREFIX = 'com.hajerypulse.devicetoken.';

let currentAccount: string | null = null;
let deviceId: string | null = null;
let token: string | null = null;

function serviceFor(accountId: string): string {
  return SERVICE_PREFIX + accountId.replace(/[^A-Za-z0-9._-]/g, '_');
}

/** Switches to the signed-in account's token. Call after every sign-in / session restore. */
export async function loadDevice(accountId: string): Promise<void> {
  currentAccount = accountId;
  token = null;
  if (!deviceId) {
    try {
      deviceId = await DeviceInfo.getUniqueId();
    } catch {
      deviceId = null; // the API answers DEVICE_ID_INVALID and the screen says so
    }
  }
  try {
    const stored = await Keychain.getGenericPassword({ service: serviceFor(accountId) });
    token = stored ? stored.password : null;
  } catch {
    // Unreadable (e.g. the OS rotated its keystore) — the user enters the token again.
    token = null;
  }
}

/** Keeps the token IT issued, once the API has accepted it. */
export async function saveDeviceToken(newToken: string): Promise<void> {
  if (!currentAccount) throw new Error('No signed-in account.');
  await Keychain.setGenericPassword('device-token', newToken, {
    service: serviceFor(currentAccount),
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  token = newToken;
}

/** Forgets the token — e.g. once the API reports the device turned off. */
export async function clearDeviceToken(): Promise<void> {
  token = null;
  if (currentAccount) {
    await Keychain.resetGenericPassword({ service: serviceFor(currentAccount) }).catch(() => undefined);
  }
}

export function getDeviceId(): string | null {
  return deviceId;
}

export function getDeviceToken(): string | null {
  return token;
}
