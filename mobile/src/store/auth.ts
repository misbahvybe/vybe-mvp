import { create } from 'zustand';
import { setAuthToken, api } from '@api/client';

export type Role = 'CUSTOMER' | 'STORE_OWNER' | 'RIDER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  /** Store / rider / admin portal — same validation as web partner login. */
  partnerLogin: (emailOrPhone: string, password: string) => Promise<void>;
  setSession: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  async login(emailOrPhone: string, password: string) {
    set({ loading: true });
    try {
      const { data } = await api.post<{
        access_token: string;
        user: User;
      }>('/auth/login', { emailOrPhone: emailOrPhone.trim(), password });
      setAuthToken(data.access_token);
      set({ token: data.access_token, user: data.user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },
  async partnerLogin(emailOrPhone: string, password: string) {
    set({ loading: true });
    try {
      const { data } = await api.post<{
        access_token: string;
        user: User;
      }>('/auth/partner-login', { emailOrPhone: emailOrPhone.trim(), password });
      setAuthToken(data.access_token);
      set({ token: data.access_token, user: data.user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },
  setSession(token: string, user: User) {
    setAuthToken(token);
    set({ token, user });
  },
  logout() {
    setAuthToken(null);
    set({ user: null, token: null });
  }
}));

