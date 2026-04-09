'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

function readPersistedAuth(): { user: User | null; token: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('vybe_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { user?: User | null; token?: string | null } };
    const user = parsed?.state?.user ?? null;
    const token = parsed?.state?.token ?? null;
    return { user, token };
  } catch {
    return null;
  }
}

/**
 * Ensures `_hasHydrated` flips true on every client mount and
 * synchronizes the store from localStorage if zustand persist hydration lags.
 */
export function AuthHydrate() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);

  useEffect(() => {
    setHasHydrated(true);

    // Best-effort sync for cases where persist hydration doesn't run (or runs late).
    const persisted = readPersistedAuth();
    const token = persisted?.token ?? (typeof window !== 'undefined' ? localStorage.getItem('vybe_token') : null);
    if (token) {
      setAuth(persisted?.user ?? null, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

