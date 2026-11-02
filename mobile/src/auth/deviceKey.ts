/**
 * This device's activation key, sent as X-Device-Key on every API request.
 *
 * The user enters a one-time activation code from IT on first sign-in; the
 * API exchanges it for this key (see DeviceActivationService on the API
 * side). It's kept in the Keychain (iOS) / Keystore-backed storage
 * (Android), one entry per signed-in account, and never shown to anyone.
 *
 * Reinstalling must require a new code. Android wipes app storage on
 * uninstall, but the iOS Keychain survives it — so the key is stored with
 * the app's install time and discarded when that no longer matches.
 * THIS_DEVICE_ONLY also stops it travelling to a new phone in a backup.
 */
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';

const SERVICE_PREFIX = 'com.hajerypulse.devicekey.';

let currentAccount: string | null = null;
let currentKey: string | null = null;

function serviceFor(accountId: string): string {
  return SERVICE_PREFIX + accountId.replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * Switches to the signed-in account's key (null if this device hasn't been
 * activated for it). Call after every sign-in / session restore.
 */
export async function loadDeviceKey(accountId: string): Promise<string | null> {
  currentAccount = accountId;
  currentKey = null;
  try {
    const stored = await Keychain.getGenericPassword({ service: serviceFor(accountId) });
    if (!stored) return null;
    const { key, installedAt } = JSON.parse(stored.password) as { key: string; installedAt: number };
    if (installedAt !== (await DeviceInfo.getFirstInstallTime())) {
      // Left over from a previous install — not valid for this one.
      await Keychain.resetGenericPassword({ service: serviceFor(accountId) });
      return null;
    }
    currentKey = key;
  } catch {
    // Unreadable (e.g. the OS rotated its keystore) — the user re-activates.
    currentKey = null;
  }
  return currentKey;
}

export async function saveDeviceKey(key: string): Promise<void> {
  if (!currentAccount) throw new Error('No signed-in account to activate.');
  const installedAt = await DeviceInfo.getFirstInstallTime();
  await Keychain.setGenericPassword('device-key', JSON.stringify({ key, installedAt }), {
    service: serviceFor(currentAccount),
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  currentKey = key;
}

/** Forgets the key — e.g. once the API reports it revoked. */
export async function clearDeviceKey(): Promise<void> {
  currentKey = null;
  if (currentAccount) {
    await Keychain.resetGenericPassword({ service: serviceFor(currentAccount) }).catch(() => undefined);
  }
}

/** The key for the signed-in account, for the API client to attach. */
export function getDeviceKey(): string | null {
  return currentKey;
}
