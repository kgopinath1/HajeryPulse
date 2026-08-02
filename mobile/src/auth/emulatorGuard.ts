/**
 * Refuses to run in release builds on an emulator/simulator — real employees
 * never run this app on one, and emulators are the environment of choice for
 * dynamic instrumentation (Frida/Xposed) and scripted, disposable abuse.
 * Skipped entirely in dev builds so local emulator testing keeps working.
 *
 * This is a heuristic deterrent, not a hard boundary: a sufficiently
 * determined attacker running Frida can hook DeviceInfo.isEmulator() itself
 * to lie about the result. It raises the bar against casual/scripted abuse —
 * it doesn't guarantee anything against a targeted attacker.
 */
import DeviceInfo from 'react-native-device-info';

export async function isBlockedEmulator(): Promise<boolean> {
  if (__DEV__) return false;
  return DeviceInfo.isEmulator();
}
