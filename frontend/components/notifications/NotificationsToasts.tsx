'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useNotificationsRealtime, type NotificationEvent } from '@/hooks/useNotificationsRealtime';

type Toast = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  data?: any;
};

function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((opts?: { times?: number; volume?: number; freq?: number }) => {
    const times = Math.max(1, Math.min(4, opts?.times ?? 1));
    const volume = Math.max(0.05, Math.min(0.5, opts?.volume ?? 0.16));
    const freq = Math.max(200, Math.min(2000, opts?.freq ?? 880));
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = now + i * 0.22;
        osc.start(t0);
        osc.stop(t0 + 0.12);
      }
    } catch {
      // ignore
    }
  }, []);
}

export function NotificationsToasts({ enableSound }: { enableSound?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, number>>({});
  const beep = useBeep();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timersRef.current[id];
    if (t) window.clearTimeout(t);
    delete timersRef.current[id];
  }, []);

  const push = useCallback(
    (n: NotificationEvent) => {
      if (enableSound) beep({ times: 1 });
      setToasts((prev) => {
        // Keep newest on top, max 3.
        const next = [{ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt, data: n.data }, ...prev];
        const uniq = new Map(next.map((x) => [x.id, x]));
        return [...uniq.values()].slice(0, 3);
      });

      // Auto-dismiss after 6s
      if (typeof window !== 'undefined') {
        if (timersRef.current[n.id]) window.clearTimeout(timersRef.current[n.id]);
        timersRef.current[n.id] = window.setTimeout(() => dismiss(n.id), 6000);
      }
    },
    [dismiss, enableSound, beep],
  );

  useNotificationsRealtime(!!token, token, push);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const id of Object.keys(timersRef.current)) {
        window.clearTimeout(timersRef.current[id]);
      }
      timersRef.current = {};
    };
  }, []);

  const visible = useMemo(() => toasts, [toasts]);
  if (!token || visible.length === 0) return null;

  return (
    <div className="fixed top-16 right-3 z-[60] space-y-2 w-[320px] max-w-[calc(100vw-24px)]">
      {visible.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 bg-white shadow-soft-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
              {t.body ? <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{t.body}</p> : null}
              {t.data?.orderId ? (
                <Link href={`/order/${t.data.orderId}`} className="text-xs text-primary mt-1 inline-block">
                  Open order
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-700 px-2 -mr-2"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

