'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useOrdersRealtime, type OrderCreatedEvent } from '@/hooks/useOrdersRealtime';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';

type OrderListItem = {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod?: string;
  paymentStatus?: string;
  customer?: { name: string; phone: string };
  address?: { fullAddress: string };
  items: { product: { name: string }; quantity: number; price: number }[];
};

function fmtMoney(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString() : '0';
}

function timeHHMM(d: string) {
  try {
    const dt = new Date(d);
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback((opts?: { times?: number; volume?: number }) => {
    const times = Math.max(1, Math.min(5, opts?.times ?? 2));
    const volume = Math.max(0.05, Math.min(0.5, opts?.volume ?? 0.18));
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
        osc.frequency.value = 880;
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

export default function StorePosPage() {
  const token = useAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastAlertAt, setLastAlertAt] = useState<string | null>(null);

  const beep = useBeep();

  const fetchStore = useCallback(async () => {
    const r = await api.get('/store-owner/store');
    setStoreId(r.data?.id ?? null);
  }, []);

  const fetchOrders = useCallback(async () => {
    const r = await api.get<OrderListItem[]>('/orders');
    setOrders(r.data ?? []);
  }, []);

  const fetchSelected = useCallback(async (id: string) => {
    const r = await api.get(`/orders/${id}`);
    setSelected(r.data ?? null);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStore(), fetchOrders()]);
    } finally {
      setLoading(false);
    }
  }, [fetchOrders, fetchStore]);

  useEffect(() => {
    refreshAll().catch(() => setLoading(false));
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    fetchSelected(selectedId).catch(() => setSelected(null));
  }, [selectedId, fetchSelected]);

  const onCreated = useCallback(
    (payload: OrderCreatedEvent) => {
      // Sound + highlight: keep it lightweight; list refresh happens via the normal callback.
      beep({ times: 3 });
      setLastAlertAt(new Date().toISOString());
      if (payload?.id) setSelectedId((prev) => prev ?? payload.id);
      // Attempt browser notifications if already allowed (POS tablets often run Chrome).
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          // eslint-disable-next-line no-new
          new Notification('New Vybe order received', {
            body: `Order #${payload.id.slice(-8).toUpperCase()} · Rs ${fmtMoney(payload.totalAmount)}`,
          });
        }
      }
    },
    [beep],
  );

  useOrdersRealtime(Boolean(token && storeId), token, 'STORE_OWNER', storeId, () => fetchOrders(), {
    onCreated,
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
  });

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore
      }
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    setActionLoading(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      await fetchOrders();
      if (selectedId === orderId) await fetchSelected(orderId);
    } catch {
      alert('Failed to update order');
    } finally {
      setActionLoading(null);
    }
  };

  const pending = useMemo(() => orders.filter((o) => o.orderStatus === 'PENDING'), [orders]);
  const preparing = useMemo(() => orders.filter((o) => o.orderStatus === 'STORE_ACCEPTED'), [orders]);
  const ready = useMemo(() => orders.filter((o) => o.orderStatus === 'READY_FOR_PICKUP'), [orders]);

  const selectedFromList = useMemo(
    () => (selectedId ? orders.find((o) => o.id === selectedId) ?? null : null),
    [orders, selectedId],
  );

  const detail = selected ?? selectedFromList;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="font-semibold text-slate-800">Login required</p>
          <p className="text-sm text-slate-600 mt-1">Open the store login on this POS device.</p>
          <Link href="/partner-login">
            <Button className="mt-4">Go to login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={44} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Vybe POS</p>
            <p className="text-sm font-semibold text-slate-800">
              {connected ? 'Live' : 'Offline'}{' '}
              <span className={`ml-1 inline-block w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
              Enable alerts
            </Button>
            <Button size="sm" variant="outline" onClick={() => beep({ times: 2 })}>
              Test sound
            </Button>
            <Button size="sm" variant="outline" onClick={refreshAll}>
              Refresh
            </Button>
          </div>
        </div>
        {lastAlertAt && (
          <div className="px-4 pb-2">
            <Card className="p-2 border-2 border-emerald-200 bg-emerald-50">
              <p className="text-sm text-emerald-900 font-medium">
                New order alert ({timeHHMM(lastAlertAt)}) — check “New Orders”
              </p>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
        <div className="lg:col-span-2 space-y-3">
          <Section title={`New Orders (${pending.length})`} tone="amber">
            {pending.length === 0 ? (
              <EmptyState text="No new orders" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pending.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    selected={selectedId === o.id}
                    onSelect={() => setSelectedId(o.id)}
                    actions={
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="lg"
                          className="flex-1 min-h-[52px]"
                          loading={actionLoading === o.id}
                          onClick={() => updateOrderStatus(o.id, 'STORE_ACCEPTED')}
                        >
                          Accept
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="flex-1 min-h-[52px]"
                          disabled={!!actionLoading}
                          onClick={() => updateOrderStatus(o.id, 'STORE_REJECTED')}
                        >
                          Reject
                        </Button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title={`Preparing (${preparing.length})`} tone="slate">
            {preparing.length === 0 ? (
              <EmptyState text="No preparing orders" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {preparing.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    selected={selectedId === o.id}
                    onSelect={() => setSelectedId(o.id)}
                    actions={
                      <div className="mt-3">
                        <Button
                          size="lg"
                          className="w-full min-h-[52px]"
                          loading={actionLoading === o.id}
                          onClick={() => updateOrderStatus(o.id, 'READY_FOR_PICKUP')}
                        >
                          Mark Ready for Pickup
                        </Button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title={`Ready for Pickup (${ready.length})`} tone="emerald">
            {ready.length === 0 ? (
              <EmptyState text="No ready orders" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ready.map((o) => (
                  <OrderCard key={o.id} o={o} selected={selectedId === o.id} onSelect={() => setSelectedId(o.id)} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="lg:col-span-1">
          <Card className="p-4 sticky top-[120px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Billing / Ticket</p>
                <p className="text-lg font-bold text-slate-800">
                  {detail ? `#${detail.id.slice(-8).toUpperCase()}` : 'Select an order'}
                </p>
              </div>
              {detail ? (
                <Link href={`/store/pos/print/${detail.id}`} target="_blank" rel="noopener noreferrer" title="58mm ticket for Sunmi / thermal">
                  <Button size="sm" variant="outline">
                    Print (58mm)
                  </Button>
                </Link>
              ) : null}
            </div>

            {!detail ? (
              <p className="text-sm text-slate-600 mt-3">Tap an order on the left to view items and total.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Payment</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {detail.paymentMethod === 'COD' ? 'COD' : 'PAID'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total</span>
                  <span className="text-xl font-bold text-accent">Rs {fmtMoney(detail.totalAmount)}</span>
                </div>
                {detail.address?.fullAddress ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Delivery</p>
                    <p className="text-sm text-slate-700 mt-1">{detail.address.fullAddress}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
                  <ul className="mt-2 space-y-1">
                    {detail.items?.map((i, idx) => (
                      <li key={idx} className="flex justify-between gap-2 text-sm">
                        <span className="text-slate-700">
                          {i.product?.name ?? 'Item'} × {Number(i.quantity)}
                        </span>
                        <span className="text-slate-800 font-medium">Rs {fmtMoney(Number(i.price) * Number(i.quantity))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'amber' | 'slate' | 'emerald';
  children: React.ReactNode;
}) {
  const border =
    tone === 'amber' ? 'border-amber-200' : tone === 'emerald' ? 'border-emerald-200' : 'border-slate-200';
  return (
    <Card className={`p-3 border-2 ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
      </div>
      {children}
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-slate-500">{text}</p>
    </div>
  );
}

function OrderCard({
  o,
  selected,
  onSelect,
  actions,
}: {
  o: OrderListItem;
  selected: boolean;
  onSelect: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left w-full ${selected ? 'ring-2 ring-primary rounded-card' : ''}`}
    >
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-slate-800">#{o.id.slice(-8).toUpperCase()}</p>
            <p className="text-sm text-slate-600 mt-0.5">
              {o.items.length} items · Rs {fmtMoney(o.totalAmount)}
            </p>
          </div>
          <span className="text-xs text-slate-500">{timeHHMM(o.createdAt)}</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {o.paymentMethod === 'COD' ? 'COD' : 'Paid'}
          {o.customer?.name ? ` · ${o.customer.name}` : ''}
        </p>
        {actions}
      </Card>
    </button>
  );
}

