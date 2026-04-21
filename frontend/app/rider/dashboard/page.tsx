'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Package, Banknote, CreditCard, ExternalLink, Wallet } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRiderAssignmentRealtime } from '@/hooks/useOrdersRealtime';
import { useLoopingOrderAlarm } from '@/hooks/useLoopingOrderAlarm';
import { RiderDeliveryPanel } from '@/components/rider/RiderDeliveryPanel';

const DELIVERY_FEE = 150; // Rider earns delivery fee per order

interface Order {
  id: string;
  orderNumber?: number;
  orderStatus: string;
  riderArrivedAt?: string | null;
  createdAt: string;
  totalAmount: number;
  paymentMethod?: string;
  store?: { name: string; address?: string; latitude?: number; longitude?: number; phone?: string };
  customer?: { name: string; phone: string };
  address?: { fullAddress: string; latitude?: number; longitude?: number };
  items: { product: { name: string }; quantity: number; price: number }[];
}

interface AvailableOrder {
  id: string;
  orderStatus: string;
  totalAmount: number;
  distanceKm: number | null;
  store?: { name: string; address?: string };
  address?: { fullAddress: string };
  customer?: { name: string };
  /** EARLY = reserve delivery while kitchen prepares; PICKUP = classic ready pool. */
  offerKind?: 'EARLY' | 'PICKUP';
}

const DISMISS_EARLY_KEY = 'vybe_dismissed_early_offers';

function loadDismissedEarlyIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_EARLY_KEY);
    const a = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(a) ? a.map(String) : []);
  } catch {
    return new Set();
  }
}

interface RiderDashboard {
  isAvailable: boolean;
  todayEarnings: number;
  completedToday: number;
  cod?: {
    currentCollectedAmount: number;
    limitPkr: number;
    remainingUntilLimit: number;
    isBlocked: boolean;
    warningMessage: string | null;
  };
}

interface RiderEarnings {
  today: { amount: number; count: number };
  week: { amount: number; count: number };
  total: { amount: number; count: number };
  balance: {
    totalEarned: number;
    totalPaidOut: number;
    reserved: number;
    available: number;
  };
  history: { kind?: 'order'; orderId: string; createdAt: string; amount: number }[];
  payoutHistory: {
    kind?: 'payout';
    id: string;
    withdrawRequestId: string;
    createdAt: string;
    amount: number;
  }[];
}

const RIDER_ACTIVE_STATUSES = [
  'PENDING',
  'STORE_ACCEPTED',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'RIDER_ACCEPTED',
  'PICKED_UP',
];

function sortRiderActive(a: Order, b: Order) {
  const prio: Record<string, number> = {
    RIDER_ACCEPTED: 0,
    PICKED_UP: 1,
    RIDER_ASSIGNED: 2,
    READY_FOR_PICKUP: 3,
    STORE_ACCEPTED: 4,
    PENDING: 4,
  };
  return (prio[a.orderStatus] ?? 99) - (prio[b.orderStatus] ?? 99);
}

function googleMapsUrl(lat?: number | string, lng?: number | string, address?: string): string {
  const la = lat != null ? Number(lat) : null;
  const ln = lng != null ? Number(lng) : null;
  if (la != null && ln != null && !isNaN(la) && !isNaN(ln)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${la},${ln}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return 'https://www.google.com/maps';
}

export default function RiderDashboardPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'dashboard' | 'earnings'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [dashboard, setDashboard] = useState<RiderDashboard | null>(null);
  const [earnings, setEarnings] = useState<RiderEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [dismissedEarlyIds, setDismissedEarlyIds] = useState<Set<string>>(new Set());

  const fetchAvailable = useCallback(async () => {
    setAvailLoading(true);
    try {
      let url = '/riders/me/available-orders';
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
          );
        });
        if (pos) {
          const la = pos.coords.latitude;
          const lo = pos.coords.longitude;
          url += `?latitude=${la}&longitude=${lo}`;
          await api.patch('/riders/me/location', { latitude: la, longitude: lo }).catch(() => {});
        }
      }
      const { data } = await api.get<AvailableOrder[]>(url);
      setAvailableOrders(data ?? []);
    } catch {
      try {
        const { data } = await api.get<AvailableOrder[]>('/riders/me/available-orders');
        setAvailableOrders(data ?? []);
      } catch {
        setAvailableOrders([]);
      }
    } finally {
      setAvailLoading(false);
    }
  }, []);

  const fetchData = useCallback(() => {
    Promise.allSettled([
      api.get<Order[]>('/orders').then((r) => r.data ?? []),
      api.get<RiderDashboard>('/riders/me').then((r) => r.data),
      api.get<RiderEarnings>('/riders/me/earnings').then((r) => r.data),
    ]).then((results) => {
      const [ordsRes, dashRes, earnRes] = results;
      if (ordsRes.status === 'fulfilled') {
        setOrders(ordsRes.value);
      } else {
        setOrders([]);
      }
      if (dashRes.status === 'fulfilled') {
        setDashboard(
          dashRes.value ?? { isAvailable: true, todayEarnings: 0, completedToday: 0 },
        );
      } else {
        setDashboard({ isAvailable: true, todayEarnings: 0, completedToday: 0 });
      }
      if (earnRes.status === 'fulfilled' && earnRes.value) {
        setEarnings(earnRes.value);
      }
      setLoading(false);
      void fetchAvailable();
    });
  }, [fetchAvailable]);

  const fetchEarnings = useCallback(() => {
    api.get<RiderEarnings>('/riders/me/earnings').then((r) => setEarnings(r.data)).catch(() => setEarnings(null));
  }, []);

  useEffect(() => fetchData(), [fetchData]);
  useEffect(() => {
    setDismissedEarlyIds(loadDismissedEarlyIds());
  }, []);
  useEffect(() => {
    if (tab === 'earnings') fetchEarnings();
  }, [tab, fetchEarnings]);

  const refreshRiderHome = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useRiderAssignmentRealtime(user?.role === 'RIDER', token, refreshRiderHome);

  const hasUndismissedEarlyOffer = useMemo(() => {
    if (tab !== 'dashboard') return false;
    return availableOrders.some((o) => o.offerKind === 'EARLY' && !dismissedEarlyIds.has(o.id));
  }, [tab, availableOrders, dismissedEarlyIds]);

  const riderNeedsPickupAck = useMemo(() => {
    if (tab !== 'dashboard') return false;
    const act = orders.filter((o) => RIDER_ACTIVE_STATUSES.includes(o.orderStatus));
    const sorted = [...act].sort(sortRiderActive);
    const ao = sorted[0];
    if (!ao) return false;
    return ao.orderStatus === 'RIDER_ASSIGNED' || ao.orderStatus === 'READY_FOR_PICKUP';
  }, [tab, orders]);

  const { stopAlarm: stopRiderAlarm } = useLoopingOrderAlarm(
    Boolean(token && (hasUndismissedEarlyOffer || riderNeedsPickupAck)),
  );

  const dismissEarlyOffer = (orderId: string) => {
    setDismissedEarlyIds((prev) => {
      const n = new Set(prev);
      n.add(orderId);
      try {
        sessionStorage.setItem(DISMISS_EARLY_KEY, JSON.stringify([...n]));
      } catch {
        // ignore
      }
      return n;
    });
  };

  const setAvailable = async (isAvailable: boolean) => {
    try {
      await api.patch('/riders/me', { isAvailable });
      setDashboard((d) => (d ? { ...d, isAvailable } : null));
    } catch {
      // ignore
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    stopRiderAlarm();
    setActionLoading(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      fetchData();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const markArrivedAtRestaurant = async (orderId: string) => {
    stopRiderAlarm();
    setActionLoading(orderId);
    try {
      await api.post(`/orders/${orderId}/rider/arrived`);
      fetchData();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not save');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmPickup = (orderId: string) => {
    if (!confirm('Have you collected the full order from the restaurant?')) return;
    void updateStatus(orderId, 'PICKED_UP');
  };

  const confirmDeliver = (orderId: string) => {
    if (!confirm('Hand the order to the customer and confirm delivery.')) return;
    void updateStatus(orderId, 'DELIVERED');
  };

  const claimOpenOrder = async (orderId: string) => {
    if (dashboard?.cod?.isBlocked) {
      alert(
        dashboard.cod.warningMessage ??
          'Deposit collected cash with admin to receive new orders.',
      );
      return;
    }
    if (
      !confirm(
        'Pick this order? You will be assigned and admin will see this as a self-pick.',
      )
    ) {
      return;
    }
    stopRiderAlarm();
    setActionLoading(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'RIDER_ASSIGNED' });
      fetchData();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not pick order');
    } finally {
      setActionLoading(null);
    }
  };

  /** Include READY_FOR_PICKUP: admin may assign captain before status was advanced (legacy) or edge cases. */
  const active = orders.filter((o) => RIDER_ACTIVE_STATUSES.includes(o.orderStatus));
  const sortedActive = [...active].sort(sortRiderActive);
  const activeOrder = sortedActive[0];
  const assignedOrders = sortedActive.slice(1);

  const acceptEarlyOffer = async (orderId: string) => {
    if (dashboard?.cod?.isBlocked) {
      alert(
        dashboard.cod.warningMessage ??
          'Deposit collected cash with admin to receive new orders.',
      );
      return;
    }
    if (activeOrder) {
      alert('Finish your current delivery before accepting another.');
      return;
    }
    stopRiderAlarm();
    setActionLoading(orderId);
    try {
      await api.post(`/riders/me/accept-early-offer/${orderId}`);
      dismissEarlyOffer(orderId);
      fetchData();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not accept offer');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Captain Dashboard" wideShell />
      <ContentPanel>
        <div className="border-b border-slate-200 bg-surface sticky top-0 z-10">
          <div className="flex">
            <button
              type="button"
              onClick={() => setTab('dashboard')}
              className={`flex-1 py-3 text-sm font-semibold ${tab === 'dashboard' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setTab('earnings')}
              className={`flex-1 py-3 text-sm font-semibold ${tab === 'earnings' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`}
            >
              Earnings
            </button>
          </div>
        </div>
        <main className="app-shell-wide py-4">
          {tab === 'dashboard' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dashboard?.isAvailable ?? true}
                  onClick={() => setAvailable(!(dashboard?.isAvailable ?? true))}
                  className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors ${
                    dashboard?.isAvailable ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform ${
                      dashboard?.isAvailable ? 'translate-x-9' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className={`text-sm mb-4 ${dashboard?.isAvailable ? 'text-green-600' : 'text-slate-500'}`}>
                {dashboard?.isAvailable ? 'Online' : 'Offline'}
              </p>

              {dashboard?.cod?.isBlocked && dashboard.cod.warningMessage && (
                <div
                  className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
                  role="status"
                >
                  {dashboard.cod.warningMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Card className="p-4 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Today Earnings</p>
                    <p className="text-xl font-bold text-accent mt-1">
                      {loading ? '—' : `${Number(dashboard?.todayEarnings ?? 0).toLocaleString()} PKR`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-3"
                    onClick={() => {
                      const amountStr = prompt(
                        'Withdraw amount (PKR)',
                        String(
                          Math.max(0, Number(earnings?.balance?.available ?? dashboard?.todayEarnings ?? 0)),
                        ),
                      );
                      if (!amountStr) return;
                      const amount = Number(amountStr);
                      if (!amount || amount <= 0) {
                        alert('Enter a valid amount');
                        return;
                      }
                      (async () => {
                        try {
                          await api.post('/withdraw/request', { amount });
                          alert('Withdraw request submitted. Admin will process within 24 hours.');
                          void fetchEarnings();
                          fetchData();
                        } catch (e) {
                          alert(
                            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                              'Failed to submit withdraw request',
                          );
                        }
                      })();
                    }}
                  >
                    Request Withdraw
                  </Button>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-slate-500 uppercase">Completed</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {loading ? '—' : dashboard?.completedToday ?? 0}
                  </p>
                </Card>
              </div>

              <Card className="p-4 mb-6 border border-amber-100 bg-amber-50/50">
                <p className="text-xs text-slate-500 uppercase tracking-wide">COD collected (unsettled)</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {loading
                    ? '—'
                    : `${Number(dashboard?.cod?.currentCollectedAmount ?? 0).toLocaleString()} PKR`}
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  {loading
                    ? ' '
                    : `Limit ${Number(dashboard?.cod?.limitPkr ?? 5000).toLocaleString()} PKR · ${Number(
                        dashboard?.cod?.remainingUntilLimit ?? 5000,
                      ).toLocaleString()} PKR remaining before pickup is blocked`}
                </p>
              </Card>

              <div className="mb-6 space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Early delivery (kitchen preparing)
                  </h2>
                  <p className="text-xs text-slate-500 mb-3">
                    New orders within 2 km — first captain to accept is reserved. Alarm stops when you accept or decline.
                  </p>
                  {availLoading && availableOrders.filter((x) => x.offerKind === 'EARLY').length === 0 ? (
                    <div className="flex justify-center py-6">
                      <Loader size={36} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableOrders
                        .filter((o) => o.offerKind === 'EARLY' && !dismissedEarlyIds.has(o.id))
                        .slice(0, 8)
                        .map((o) => (
                          <Card
                            key={o.id}
                            className="p-4 flex flex-wrap items-center justify-between gap-3 border-2 border-amber-200 bg-amber-50/40"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-amber-800 uppercase">Early offer</p>
                              <p className="font-semibold text-slate-800 truncate">{o.store?.name ?? 'Store'}</p>
                              <p className="text-sm text-slate-600 truncate">
                                {o.customer?.name ?? 'Customer'} · Rs {Number(o.totalAmount).toLocaleString()}
                              </p>
                              {o.distanceKm != null && (
                                <p className="text-xs text-green-700 font-medium mt-1">~{o.distanceKm} km</p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                type="button"
                                disabled={!!actionLoading}
                                onClick={() => {
                                  dismissEarlyOffer(o.id);
                                  stopRiderAlarm();
                                }}
                              >
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={!!actionLoading || !!activeOrder || !!dashboard?.cod?.isBlocked}
                                loading={actionLoading === o.id}
                                onClick={() => void acceptEarlyOffer(o.id)}
                              >
                                Accept
                              </Button>
                            </div>
                          </Card>
                        ))}
                      {availableOrders.filter((o) => o.offerKind === 'EARLY' && !dismissedEarlyIds.has(o.id))
                        .length === 0 && !availLoading ? (
                        <Card className="p-4 text-center text-sm text-slate-500">No early offers right now.</Card>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Ready for pickup (open pool)
                  </h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Food is ready — pick to claim if no early captain took it. Within 2 km only.
                  </p>
                  {availLoading && availableOrders.filter((x) => x.offerKind === 'PICKUP').length === 0 ? (
                    <div className="flex justify-center py-6">
                      <Loader size={36} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableOrders
                        .filter((o) => o.offerKind === 'PICKUP')
                        .slice(0, 8)
                        .map((o) => (
                          <Card key={o.id} className="p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{o.store?.name ?? 'Store'}</p>
                              <p className="text-sm text-slate-600 truncate">
                                {o.customer?.name ?? 'Customer'} · Rs {Number(o.totalAmount).toLocaleString()}
                              </p>
                              {o.distanceKm != null && (
                                <p className="text-xs text-green-700 font-medium mt-1">~{o.distanceKm} km</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={!!actionLoading || !!activeOrder || !!dashboard?.cod?.isBlocked}
                              loading={actionLoading === o.id}
                              onClick={() => {
                                if (dashboard?.cod?.isBlocked) {
                                  alert(
                                    dashboard.cod.warningMessage ??
                                      'Deposit collected cash with admin to receive new orders.',
                                  );
                                  return;
                                }
                                if (activeOrder) {
                                  alert('Finish your current delivery before picking another.');
                                  return;
                                }
                                void claimOpenOrder(o.id);
                              }}
                            >
                              Pick
                            </Button>
                          </Card>
                        ))}
                      {availableOrders.filter((o) => o.offerKind === 'PICKUP').length === 0 && !availLoading ? (
                        <Card className="p-4 text-center text-sm text-slate-500">No open pickup orders.</Card>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader size={44} />
                </div>
              ) : activeOrder ? (
                <Card className="mb-6 border-2 border-primary/40 overflow-hidden">
                  <div className="bg-primary/5 px-4 py-3 border-b border-slate-200">
                    <p className="text-sm font-bold text-primary">ACTIVE ORDER</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <p className="font-bold text-lg text-slate-800">
                      Order #{activeOrder.orderNumber ?? activeOrder.id.slice(-8).toUpperCase()}
                    </p>
                    {(activeOrder.orderStatus === 'PENDING' || activeOrder.orderStatus === 'STORE_ACCEPTED') && (
                      <p className="text-sm rounded-lg bg-sky-50 border border-sky-200 text-sky-900 px-3 py-2">
                        You are reserved for this delivery. Head toward the restaurant — when they mark the order ready,
                        confirm pickup below.
                      </p>
                    )}
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Pickup</p>
                      <p className="font-semibold">{activeOrder.store?.name ?? 'Store'}</p>
                      <p className="text-sm text-slate-600">{activeOrder.store?.address ?? '—'}</p>
                      <a
                        href={googleMapsUrl(activeOrder.store?.latitude, activeOrder.store?.longitude, activeOrder.store?.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary text-sm mt-1"
                      >
                        <ExternalLink className="w-4 h-4" /> Open in Google Maps
                      </a>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Drop</p>
                      <p className="font-semibold">{activeOrder.customer?.name ?? 'Customer'}</p>
                      <p className="text-sm text-slate-600">{activeOrder.address?.fullAddress ?? '—'}</p>
                      <a
                        href={googleMapsUrl(activeOrder.address?.latitude, activeOrder.address?.longitude, activeOrder.address?.fullAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary text-sm mt-1"
                      >
                        <ExternalLink className="w-4 h-4" /> Open in Google Maps
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {activeOrder.paymentMethod === 'COD' ? (
                        <>
                          <Banknote className="w-5 h-5 text-amber-600" />
                          <span className="font-bold text-accent">Amount to collect: {Number(activeOrder.totalAmount).toLocaleString()} PKR</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-700">Paid (no collection)</span>
                        </>
                      )}
                    </div>
                    <RiderDeliveryPanel
                      order={activeOrder}
                      riderId={user?.id ?? ''}
                      loading={!!actionLoading && actionLoading === activeOrder.id}
                      onAccept={() => updateStatus(activeOrder.id, 'RIDER_ACCEPTED')}
                      onReject={() => updateStatus(activeOrder.id, 'READY_FOR_PICKUP')}
                      onArrived={() => void markArrivedAtRestaurant(activeOrder.id)}
                      onPickup={() => confirmPickup(activeOrder.id)}
                      onDeliver={() => confirmDeliver(activeOrder.id)}
                    />
                    <Link href={`/rider/orders/${activeOrder.id}`} className="block text-center text-sm text-primary">
                      View full details
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card className="mb-6 py-12 text-center">
                  <Package className="w-16 h-16 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-slate-600 font-medium">No active order</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Pick from nearest offers above, or wait for admin to assign you.
                  </p>
                </Card>
              )}

              {assignedOrders.length > 0 && (
                <>
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Assigned Orders</h2>
                  <div className="space-y-2">
                    {assignedOrders.map((o) => (
                      <Link key={o.id} href={`/rider/orders/${o.id}`}>
                        <Card className="flex items-center justify-between px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-800">#{o.id.slice(-8).toUpperCase()}</p>
                            <p className="text-sm text-slate-600">{o.store?.name ?? 'Store'}</p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              o.orderStatus === 'RIDER_ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                              o.orderStatus === 'PICKED_UP' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {o.orderStatus === 'RIDER_ACCEPTED' ? 'Accepted' : o.orderStatus === 'PICKED_UP' ? 'Picked up' : 'Assigned'}
                            </span>
                            <p className="text-accent font-semibold text-sm mt-1">{DELIVERY_FEE} PKR</p>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'earnings' && (
            <>
              {earnings ? (
                <>
                  {dashboard?.cod && (
                    <Card className="p-4 mb-4 border border-amber-100 bg-amber-50/40">
                      <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">COD held (to deposit)</p>
                      <p className="text-lg font-bold text-amber-950">
                        {Number(dashboard.cod.currentCollectedAmount).toLocaleString()} PKR
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {dashboard.cod.isBlocked
                          ? 'Pickup blocked until admin confirms deposit.'
                          : `${Number(dashboard.cod.remainingUntilLimit).toLocaleString()} PKR until limit`}
                      </p>
                    </Card>
                  )}
                  <Card className="p-4 mb-4 border border-emerald-100 bg-emerald-50/40">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Available to withdraw</p>
                    <p className="text-2xl font-bold text-emerald-800">
                      {(earnings.balance?.available ?? 0).toLocaleString()} PKR
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Earned {(earnings.balance?.totalEarned ?? 0).toLocaleString()} PKR · Paid out{' '}
                      {(earnings.balance?.totalPaidOut ?? 0).toLocaleString()} PKR · Pending requests{' '}
                      {(earnings.balance?.reserved ?? 0).toLocaleString()} PKR
                    </p>
                  </Card>
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    <Card className="p-4 text-center">
                      <p className="text-xs text-slate-500">Today</p>
                      <p className="text-lg font-bold text-accent">{earnings.today.amount.toLocaleString()} PKR</p>
                      <p className="text-xs text-slate-500">{earnings.today.count} orders</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-xs text-slate-500">This Week</p>
                      <p className="text-lg font-bold text-slate-800">{earnings.week.amount.toLocaleString()} PKR</p>
                      <p className="text-xs text-slate-500">{earnings.week.count} orders</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-lg font-bold text-slate-800">{earnings.total.amount.toLocaleString()} PKR</p>
                      <p className="text-xs text-slate-500">{earnings.total.count} orders</p>
                    </Card>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Completed orders</h3>
                  <div className="space-y-2">
                    {earnings.history.map((e) => (
                      <Card key={e.orderId} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">#{e.orderId.slice(-8).toUpperCase()}</p>
                          <p className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="font-bold text-accent">{e.amount.toLocaleString()} PKR</p>
                      </Card>
                    ))}
                    {earnings.history.length === 0 && (
                      <Card className="py-8 text-center">
                        <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500">No earnings yet</p>
                      </Card>
                    )}
                  </div>
                  {(earnings.payoutHistory ?? []).length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-6">Withdrawals paid</h3>
                      <div className="space-y-2">
                        {(earnings.payoutHistory ?? []).map((p) => (
                          <Card key={p.id} className="p-4 flex justify-between items-center border-l-4 border-emerald-500">
                            <div>
                              <p className="font-medium text-emerald-900">Paid to bank</p>
                              <p className="text-xs text-slate-500">
                                {new Date(p.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <p className="font-bold text-emerald-800">−{p.amount.toLocaleString()} PKR</p>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex justify-center py-12">
                  <Loader size={44} />
                </div>
              )}
            </>
          )}
        </main>
      </ContentPanel>
    </div>
  );
}
