'use client';

import { useEffect, useRef } from 'react';
import { ADMIN_ORDERS_REFRESH } from '@/lib/adminOrdersRefresh';

/**
 * Listens for the admin-wide order refresh (from {@link AdminOrderRealtimeBridge}).
 * Keeps a stable listener while `onRefresh` can change every render.
 */
export function useAdminOrdersRefresh(onRefresh: () => void) {
  const ref = useRef(onRefresh);
  ref.current = onRefresh;
  useEffect(() => {
    const h = () => {
      ref.current();
    };
    window.addEventListener(ADMIN_ORDERS_REFRESH, h);
    return () => window.removeEventListener(ADMIN_ORDERS_REFRESH, h);
  }, []);
}
