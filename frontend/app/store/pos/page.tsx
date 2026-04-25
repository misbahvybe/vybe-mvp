'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useOrdersRealtime, type OrderCreatedEvent } from '@/hooks/useOrdersRealtime';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { StoreOwnerNavTabs } from '@/components/store/StoreOwnerNavTabs';
import { enableWebPushForCurrentUser, getWebPushUiStatus, type WebPushUiStatus } from '@/services/push';
import { useLoopingOrderAlarm } from '@/hooks/useLoopingOrderAlarm';
import { printOrderSlip, type OrderSlipInput } from '@/lib/printOrderSlip';
import { formatOrderNo } from '@/lib/orderDisplay';

type OrderListItem = {
  id: string;
  orderNumber?: number;
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

function orderToSlip(
  storeName: string,
  o: OrderListItem,
): OrderSlipInput {
  return {
    storeName,
    orderId: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    customerName: o.customer?.name,
    customerPhone: o.customer?.phone,
    deliveryAddress: o.address?.fullAddress,
    lines: o.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      lineTotal: Number(i.price) * Number(i.quantity),
    })),
    totalAmount: Number(o.totalAmount),
    paymentMethodLabel:
      o.paymentMethod === 'COD'
        ? 'Cash on delivery (COD)'
        : o.paymentMethod === 'CARD'
          ? 'Card / online'
          : (o.paymentMethod ?? '—'),
  };
}

export default function StorePosPage() {
  const token = useAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Store');
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastAlertAt, setLastAlertAt] = useState<string | null>(null);
  const [pushUi, setPushUi] = useState<WebPushUiStatus | null>(null);
  const [posAutoAccept, setPosAutoAccept] = useState(false);
  const [posNewOrderSound, setPosNewOrderSound] = useState(false);
  const soundClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posAutoAcceptRef = useRef(false);
  const storeNameRef = useRef('Store');
  useEffect(() => {
    posAutoAcceptRef.current = posAutoAccept;
  }, [posAutoAccept]);
  useEffect(() => {
    storeNameRef.current = storeName;
  }, [storeName]);

  const fetchStore = useCallback(async () => {
    const r = await api.get<{
      id?: string;
      name?: string;
      posAutoAcceptOrders?: boolean;
    }>('/store-owner/store');
    setStoreId(r.data?.id ?? null);
    setStoreName(typeof r.data?.name === 'string' ? r.data.name : 'Store');
    setPosAutoAccept(r.data?.posAutoAcceptOrders === true);
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
    void getWebPushUiStatus(Boolean(token)).then(setPushUi);
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    fetchSelected(selectedId).catch(() => setSelected(null));
  }, [selectedId, fetchSelected]);

  const onCreated = useCallback((payload: OrderCreatedEvent) => {
    setLastAlertAt(new Date().toISOString());
    if (payload?.id) setSelectedId((prev) => prev ?? payload.id);
    if (soundClearRef.current) clearTimeout(soundClearRef.current);
    setPosNewOrderSound(true);
    soundClearRef.current = setTimeout(() => {
      setPosNewOrderSound(false);
      soundClearRef.current = null;
    }, 120_000);
    if (posAutoAcceptRef.current) {
      const sid = storeNameRef.current;
      void api.get<OrderListItem>(`/orders/${payload.id}`).then((r) => {
        const o = r.data;
        if (o) printOrderSlip(orderToSlip(sid, o));
      });
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        // eslint-disable-next-line no-new
        new Notification('New Vybe order received', {
          body: `Order ${formatOrderNo(payload.orderNumber, payload.id)} · Rs ${fmtMoney(payload.totalAmount)}`,
        });
      }
    }
  }, []);

  useOrdersRealtime(Boolean(token), token, 'STORE_OWNER', storeId, () => fetchOrders(), {
    onCreated,
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
  });

  // Fallback polling: if the socket is offline, refetch frequently.
  useEffect(() => {
    if (!token) return;
    if (connected) return;
    const id = setInterval(() => {
      void fetchOrders();
    }, 8000);
    return () => clearInterval(id);
  }, [token, connected, fetchOrders]);

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

  const pending = useMemo(() => orders.filter((o) => o.orderStatus === 'PENDING'), [orders]);
  const preparing = useMemo(() => orders.filter((o) => o.orderStatus === 'STORE_ACCEPTED'), [orders]);
  const ready = useMemo(() => orders.filter((o) => o.orderStatus === 'READY_FOR_PICKUP'), [orders]);

  const shouldRingPos = posAutoAccept
    ? Boolean(token && posNewOrderSound && !actionLoading)
    : Boolean(token && pending.length > 0 && !actionLoading);
  const { stopAlarm: stopPosAlarm } = useLoopingOrderAlarm(shouldRingPos);

  const dismissPosAlarm = useCallback(() => {
    stopPosAlarm();
    if (soundClearRef.current) {
      clearTimeout(soundClearRef.current);
      soundClearRef.current = null;
    }
    setPosNewOrderSound(false);
  }, [stopPosAlarm]);

  const updateOrderStatus = async (orderId: string, status: string, slipForPrint?: OrderListItem) => {
    stopPosAlarm();
    setActionLoading(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      await fetchOrders();
      if (selectedId === orderId) await fetchSelected(orderId);
      if (status === 'STORE_ACCEPTED' && slipForPrint) {
        printOrderSlip(orderToSlip(storeName, slipForPrint));
      }
    } catch {
      alert('Failed to update order');
    } finally {
      setActionLoading(null);
    }
  };

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
            {pushUi && (
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  pushUi.backendConfigured === false
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : pushUi.deviceSubscribed && pushUi.permission === 'granted'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
                title={`Supported: ${pushUi.supported} | Permission: ${pushUi.permission} | Subscribed: ${pushUi.deviceSubscribed} | Backend: ${String(pushUi.backendConfigured)}`}
              >
                Push:{' '}
                {pushUi.backendConfigured === false
                  ? 'Server off'
                  : pushUi.deviceSubscribed && pushUi.permission === 'granted'
                    ? 'On'
                    : 'Off'}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
              Enable alerts
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void enableWebPushForCurrentUser().then((r) => {
                  if (!r.ok) alert(`Push not enabled (${r.reason ?? 'unknown'})`);
                  else alert('Push enabled. You will receive locked-screen notifications.');
                  void getWebPushUiStatus(Boolean(token)).then(setPushUi);
                });
              }}
            >
              Enable push
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const a = new Audio('/beep.wav');
                a.volume = 0.85;
                void a.play().catch(() => {});
              }}
            >
              Test alarm
            </Button>
            {posAutoAccept && shouldRingPos && (
              <Button size="sm" variant="primary" onClick={dismissPosAlarm}>
                Stop alert
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={refreshAll}>
              Refresh
            </Button>
          </div>
        </div>
        {lastAlertAt && (
          <div className="px-4 pb-2">
            <Card className="p-2 border-2 border-emerald-200 bg-emerald-50">
              <p className="text-sm text-emerald-900 font-medium">
                {posAutoAccept
                  ? `New order (${timeHHMM(lastAlertAt)}) — auto-accepted. Check “Preparing” and listen for the alarm.`
                  : `New order alert (${timeHHMM(lastAlertAt)}) — check “New Orders”`}
              </p>
            </Card>
          </div>
        )}
        {posAutoAccept && (
          <div className="px-4 pb-2 text-xs text-slate-600">
            Auto-accept mode: orders go straight to Preparing. Use sound + kitchen print. Enable this on the server
            (VYBE_POS_AUTO_ACCEPT_ORDERS) only after your printer and tablet are set up.
          </div>
        )}
        <Suspense fallback={null}>
          <StoreOwnerNavTabs />
        </Suspense>
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
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="lg"
                          variant="outline"
                          className="flex-1 min-h-[52px] min-w-[120px]"
                          type="button"
                          disabled={!!actionLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            printOrderSlip(orderToSlip(storeName, o));
                          }}
                        >
                          Print slip
                        </Button>
                        {!posAutoAccept && (
                          <>
                            <Button
                              size="lg"
                              className="flex-1 min-h-[52px] min-w-[120px]"
                              loading={actionLoading === o.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void updateOrderStatus(o.id, 'STORE_ACCEPTED', o);
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              size="lg"
                              variant="outline"
                              className="flex-1 min-h-[52px] min-w-[120px]"
                              disabled={!!actionLoading}
                              onClick={(e) => {
                                e.stopPropagation();
                                void updateOrderStatus(o.id, 'STORE_REJECTED');
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
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
                  {detail ? formatOrderNo(detail.orderNumber, detail.id) : 'Select an order'}
                </p>
              </div>
              {detail ? (
                <Link href={`/store/pos/print/${detail.id}`} target="_blank" rel="noopener noreferrer" title="58mm thermal / browser print">
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
            <p className="text-base font-bold text-slate-800">{formatOrderNo(o.orderNumber, o.id)}</p>
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

