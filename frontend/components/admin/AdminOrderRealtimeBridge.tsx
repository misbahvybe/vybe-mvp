'use client';

import { useAuthStore } from '@/store/authStore';
import { useOrdersRealtime } from '@/hooks/useOrdersRealtime';
import { emitAdminOrdersRefresh } from '@/lib/adminOrdersRefresh';
import { playNewOrderChime } from '@/lib/playNewOrderChime';
import { formatOrderNo } from '@/lib/orderDisplay';

/**
 * Single Socket.IO connection for the admin shell: chime + optional desktop
 * notification on new orders; emits a window event so dashboard/orders lists refresh.
 */
export function AdminOrderRealtimeBridge() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const enabled = hasHydrated && Boolean(token) && user?.role === 'ADMIN';

  useOrdersRealtime(enabled, token, 'ADMIN', null, () => emitAdminOrdersRefresh(), {
    onCreated: (payload) => {
      if (!payload?.id) return;
      playNewOrderChime();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          // eslint-disable-next-line no-new
          new Notification('New Vybe order', {
            body: `${formatOrderNo(payload.orderNumber, payload.id)} · ${payload.customer?.name ?? 'Customer'}`,
          });
        } catch {
          // ignore
        }
      }
    },
  });

  return null;
}
