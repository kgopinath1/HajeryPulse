/**
 * Stable per-install device identifier, sent on every API request so the
 * backend's device registry can recognize — and, if needed, blacklist —
 * this installation. Self-reported by the client: see DeviceControlMiddleware
 * on the API side for why this isn't a hard security boundary on its own.
 */
import DeviceInfo from 'react-native-device-info';

let cached: string | null = null;
let pending: Promise<string> | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  if (!pending) {
    pending = DeviceInfo.getUniqueId().then(id => {
      cached = id;
      return id;
    });
  }
  return pending;
}
