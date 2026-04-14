'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useNotificationsRealtime, type NotificationEvent } from '@/hooks/useNotificationsRealtime';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  data?: any;
};

function timeAgo(d: string) {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

export function NotificationsBell({ compact }: { compact?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotifRow[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get<NotifRow[]>('/notifications', { params: { take: 20 } });
      setRows(r.data ?? []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token, load]);

  const onNotif = useCallback((n: NotificationEvent) => {
    setRows((prev) => {
      const next = [{ ...n, createdAt: n.createdAt } as any, ...prev];
      const uniq = new Map(next.map((x) => [x.id, x]));
      return [...uniq.values()].slice(0, 20);
    });
  }, []);

  useNotificationsRealtime(!!token, token, onNotif);

  const unread = useMemo(() => rows.filter((r) => !r.isRead).length, [rows]);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setRows((prev) => prev.map((r) => ({ ...r, isRead: true })));
    } catch {
      // ignore
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: true } : r)));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-700" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 ${compact ? 'w-[320px]' : 'w-[380px]'} z-50`}>
          <Card className="p-3 shadow-soft-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-slate-800">Notifications</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={load}>
                  Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={markAllRead} disabled={unread === 0}>
                  Mark all read
                </Button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto space-y-2">
              {rows.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No notifications</p>
              ) : (
                rows.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 border ${
                      n.isRead ? 'border-slate-100 bg-white' : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                        {n.body ? <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.body}</p> : null}
                        <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)} ago</p>
                      </div>
                      {n.data?.orderId ? (
                        <Link
                          href={`/order/${n.data.orderId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary whitespace-nowrap"
                        >
                          View
                        </Link>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

