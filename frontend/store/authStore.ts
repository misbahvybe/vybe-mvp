import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  _hasHydrated: boolean;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      _hasHydrated: false,
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          if (token) localStorage.setItem('vybe_token', token);
          else localStorage.removeItem('vybe_token');
        }
        set({ user, token });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('vybe_token');
          localStorage.removeItem('vybe_user');
        }
        set({ user: null, token: null });
      },
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'vybe_user',
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state, err) => {
        // Sync vybe_token before _hasHydrated so axios interceptors see the same token as the store
        // (avoids 401 on /orders/* right after redirect, e.g. payment return to /order/:id).
        if (!err && typeof window !== 'undefined' && state?.token) {
          localStorage.setItem('vybe_token', state.token);
        }
        useAuthStore.getState().setHasHydrated(true);
      },
    }
  )
);
