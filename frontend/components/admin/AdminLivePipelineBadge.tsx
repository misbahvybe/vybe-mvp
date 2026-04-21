'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { getSocketOrigin, SOCKET_IO_CLIENT_OPTIONS } from '@/services/socketUrl';
import api from '@/services/api';

/**
 * Real-time count of in-flight orders (same definition as GET /admin/orders/live).
 * Updates over Socket.IO — no polling.
 */
export function AdminLivePipelineBadge() {
  const token = useAuthStore((s) => s.token);
  const [count, setCount] = useState<number | null>(null);

  const fetchCount = useCallback(() => {
    api
      .get<{ count: number }>('/admin/orders/live/count')
      .then((r) => setCount(typeof r.data?.count === 'number' ? r.data.count : 0))
      .catch(() => setCount(null));
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!token?.trim()) return;
    let socket: Socket | null = null;
    try {
      socket = io(getSocketOrigin(), {
        ...SOCKET_IO_CLIENT_OPTIONS,
        auth: { token },
        reconnectionAttempts: 12,
        reconnectionDelay: 1500,
      });
      const tick = () => fetchCount();
      socket.on('connect', tick);
      socket.on('admin:pipeline:updated', tick);
      socket.on('order:created', tick);
      socket.on('order:updated', tick);
      socket.on('order:rider_self_claimed', tick);
    } catch {
      // ignore
    }
    return () => {
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [token, fetchCount]);

  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors mr-2"
      title="Live pipeline orders (placed → out for delivery)"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
      Live
      <span className="tabular-nums text-primary">{count ?? '—'}</span>
    </Link>
  );
}
