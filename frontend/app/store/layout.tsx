'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      if (pathname?.startsWith('/store')) router.replace('/partner-login');
      return;
    }
    if (user && user.role !== 'STORE_OWNER') {
      router.replace('/');
      return;
    }
  }, [hasHydrated, token, pathname, router, user]);

  return <>{children}</>;
}
