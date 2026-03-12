import { create } from 'zustand';
import { setAuthToken, api } from '@api/client';

export type Role = 'CUSTOMER' | 'STORE_OWNER' | 'RIDER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
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
  logout() {
    setAuthToken(null);
    set({ user: null, token: null });
  }
}));

