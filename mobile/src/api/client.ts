import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveBackendUrl() {
  const configured =
    (Constants.expoConfig?.extra as { backendUrl?: string } | undefined)?.backendUrl?.trim() ??
    '';

  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  if (host) {
    return `http://${host}:4000/api/v1`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api/v1';
  }

  return 'http://localhost:4000/api/v1';
}

const backendUrl = resolveBackendUrl();

/** Same base URL used by `api` (includes `/api/v1`). */
export function getBackendBaseUrl(): string {
  return backendUrl;
}

/** Socket.IO uses the API host origin only (no `/api/v1` path). */
export function getSocketOrigin(): string {
  try {
    const u = new URL(backendUrl);
    return u.origin;
  } catch {
    return 'http://localhost:4000';
  }
}

export const api = axios.create({
  baseURL: backendUrl,
  withCredentials: false
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

