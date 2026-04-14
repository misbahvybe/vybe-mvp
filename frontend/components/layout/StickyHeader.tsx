'use client';

import Link from 'next/link';
import { BRAND_FULL } from '@/constants/brand';
import { useAuthStore } from '@/store/authStore';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';
import { NotificationsToasts } from '@/components/notifications/NotificationsToasts';

interface StickyHeaderProps {
  title: string;
  backHref?: string;
  rightAction?: React.ReactNode;
  /** Wider column on desktop (store / rider / staff order view). Customer shell stays phone-width. */
  wideShell?: boolean;
}

export function StickyHeader({ title, backHref, rightAction, wideShell = false }: StickyHeaderProps) {
  const isBrand = !backHref && title === BRAND_FULL;
  const shell = wideShell ? 'app-shell-wide' : 'app-shell-narrow';
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const showBell = Boolean(token && (user?.role === 'CUSTOMER' || user?.role === 'STORE_OWNER'));
  const enableSound = Boolean(user?.role === 'STORE_OWNER' || user?.role === 'CUSTOMER');
  return (
    <>
      <header className="sticky top-0 z-40 bg-primary-dark safe-top">
        <div className={`${shell} flex items-center justify-between min-h-14 py-1.5`}>
          <div className="w-10 flex items-center shrink-0">
            {backHref ? (
              <Link href={backHref} className="p-2 -ml-2 text-white" aria-label="Back">
                ←
              </Link>
            ) : null}
          </div>
          <h1
            className={`font-bold text-white flex-1 text-center px-1 leading-tight ${
              isBrand ? 'text-base sm:text-lg tracking-tight line-clamp-2' : 'text-lg truncate'
            }`}
          >
            {title}
          </h1>
          <div className="w-20 flex items-center justify-end gap-0 text-white [&>a]:text-white [&>button]:text-white shrink-0">
            {rightAction ?? (showBell ? <NotificationsBell compact /> : null)}
          </div>
        </div>
      </header>
      {showBell ? <NotificationsToasts enableSound={enableSound} /> : null}
    </>
  );
}
