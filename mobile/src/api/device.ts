import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getDeviceId } from '@auth/deviceToken';
import { apiClient } from './client';

/**
 * "Get token": asks IT for a token for this device. Resolves to whether IT
 * was emailed (false = the request is saved but the user should contact
 * IT). See DeviceController on the API.
 */
export async function requestDeviceToken(): Promise<{ itNotified: boolean }> {
  const { data } = await apiClient.post<{ itNotified: boolean }>('/device/request-token', {
    deviceId: getDeviceId(),
    platform: Platform.OS,
    deviceName: `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`,
  });
  return data;
}

/**
 * Activates this device with the token from IT. Rejects with an ApiError
 * (TOKEN_INVALID / TOKEN_EXPIRED / TOKEN_NOT_ISSUED / TOO_MANY_ATTEMPTS /
 * DEVICE_LIMIT) whose message is written for the user.
 */
export async function activateDevice(token: string): Promise<void> {
  await apiClient.post('/device/activate', { deviceId: getDeviceId(), token });
}
