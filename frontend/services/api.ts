import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';

let baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
// Ensure absolute URL (fixes Vercel env missing https://)
if (baseURL && !baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
  baseURL = `https://${baseURL}`;
}

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = useAuthStore.getState().token ?? localStorage.getItem('vybe_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    if (!localStorage.getItem('vybe_token')) localStorage.setItem('vybe_token', token);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      // Avoid nuking auth during initial hydration where token may not yet be copied to `vybe_token`.
      const hadToken = Boolean(localStorage.getItem('vybe_token'));
      const hadAuthHeader = Boolean(err?.config?.headers?.Authorization);
      if (hadToken || hadAuthHeader) {
        localStorage.removeItem('vybe_token');
        localStorage.removeItem('vybe_user');
        window.dispatchEvent(new Event('vybe_unauthorized'));
      }
    }
    return Promise.reject(err);
  }
);

export default api;
