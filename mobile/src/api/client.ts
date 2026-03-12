import axios from 'axios';
import Constants from 'expo-constants';

const backendUrl =
  (Constants.expoConfig?.extra as { backendUrl?: string } | undefined)?.backendUrl ??
  'http://localhost:4000/api/v1';

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

