'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

/** Listens for 401 responses and logs out + redirects to login */
export function AuthListener() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      router.replace('/auth/login');
    };
    window.addEventListener('vybe_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('vybe_unauthorized', handleUnauthorized);
  }, [logout, router]);

  return null;
}
