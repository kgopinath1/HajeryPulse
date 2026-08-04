/**
 * Runtime environment checks (MASTG-BEST-0046/0053/0041/0047) — release
 * builds only, so local emulator/dev testing keeps working.
 *
 * These are heuristic deterrents, not a hard boundary: a sufficiently
 * determined attacker running Frida can hook these checks themselves to lie
 * about the result. They raise the bar against casual/scripted abuse — they
 * don't guarantee anything against a targeted attacker.
 */
import { NativeModules, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/** MASTG-BEST-0046/0053 — standard emulators and known third-party
 * virtualization platforms (Genymotion, NoxPlayer, MEmu, etc. — see
 * react-native-device-info's isEmulator() implementation). */
export async function isBlockedEmulator(): Promise<boolean> {
  if (__DEV__) return false;
  return DeviceInfo.isEmulator();
}

/** MASTG-BEST-0041 — Frida/Xposed hooking signals on Android, via the
 * SecurityChecks native module (see MainActivity's SecurityChecksModule.kt).
 * No iOS equivalent here — iOS's anti-debugging/anti-injection/jailbreak
 * checks live natively in AppDelegate.swift instead, checked once at launch. */
export function isBlockedByHooking(): boolean {
  if (__DEV__) return false;
  if (Platform.OS !== 'android') return false;
  try {
    return NativeModules.SecurityChecks?.isHookingDetectedSync?.() ?? false;
  } catch {
    return false;
  }
}

/** Combined check used both at boot and by the periodic re-check — a device
 * could become an emulator-like or hooked environment only after launch
 * (e.g. Frida attaching mid-session), so this isn't just a one-time gate. */
export async function isRuntimeCompromised(): Promise<boolean> {
  return (await isBlockedEmulator()) || isBlockedByHooking();
}
