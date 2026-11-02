import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { apiClient } from './client';

/**
 * Exchanges the activation code from IT for this device's key. Rejects with
 * an ApiError (CODE_INVALID / CODE_EXPIRED / CODE_USED / TOO_MANY_ATTEMPTS)
 * whose message is written for the user. See DeviceController on the API.
 */
export async function activateDevice(code: string): Promise<string> {
  const { data } = await apiClient.post<{ deviceKey: string }>('/device/activate', {
    code,
    platform: Platform.OS,
    deviceName: `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`,
  });
  return data.deviceKey;
}
