'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { BottomNav } from '@/components/layout/BottomNav';

const noNavPaths = ['/auth', '/auth/signup', '/auth/login', '/auth/rider', '/auth/partner'];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/orders') || pathname?.startsWith('/cart') || pathname?.startsWith('/wallet') || pathname?.startsWith('/more') || pathname?.startsWith('/profile') || pathname?.startsWith('/addresses')) {
        router.replace('/auth/login');
      }
      return;
    }
    if (user && user.role !== 'CUSTOMER') {
      router.replace('/');
      return;
    }
  }, [hasHydrated, token, pathname, router, user]);

  const showNav = pathname && !noNavPaths.some((p) => pathname.startsWith(p)) && (pathname.startsWith('/dashboard') || pathname.startsWith('/orders') || pathname.startsWith('/cart') || pathname.startsWith('/wallet') || pathname.startsWith('/more') || pathname.startsWith('/profile') || pathname.startsWith('/addresses'));

  return (
    <>
      {children}
      {showNav && <BottomNav />}
    </>
  );
}
