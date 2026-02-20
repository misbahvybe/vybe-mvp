'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Package,
  MapPin,
  Banknote,
  CreditCard,
  ExternalLink,
  Wallet,
  Check,
  X,
} from 'lucide-react';
import api from '@/services/api';

const DELIVERY_FEE = 150; // Rider earns delivery fee per order

interface Order {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod?: string;
  store?: { name: string; address?: string; latitude?: number; longitude?: number; phone?: string };
  customer?: { name: string; phone: string };
  address?: { fullAddress: string; latitude?: number; longitude?: number };
  items: { product: { name: string }; quantity: number; price: number }[];
}

interface RiderDashboard {
  isAvailable: boolean;
  todayEarnings: number;
  completedToday: number;
}

interface RiderEarnings {
  today: { amount: number; count: number };
  week: { amount: number; count: number };
  total: { amount: number; count: number };
  history: { orderId: string; createdAt: string; amount: number }[];
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
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'dashboard' | 'earnings'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [dashboard, setDashboard] = useState<RiderDashboard | null>(null);
  const [earnings, setEarnings] = useState<RiderEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    Promise.all([
      api.get<Order[]>('/orders').then((r) => r.data ?? []),
      api.get<RiderDashboard>('/riders/me').then((r) => r.data),
    ])
      .then(([ords, dash]) => {
        setOrders(ords);
        setDashboard(dash ?? { isAvailable: true, todayEarnings: 0, completedToday: 0 });
      })
      .catch(() => {
        setOrders([]);
        setDashboard({ isAvailable: true, todayEarnings: 0, completedToday: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchEarnings = useCallback(() => {
    api.get<RiderEarnings>('/riders/me/earnings').then((r) => setEarnings(r.data)).catch(() => setEarnings(null));
  }, []);

  useEffect(() => fetchData(), [fetchData]);
  useEffect(() => {
    if (tab === 'earnings') fetchEarnings();
  }, [tab, fetchEarnings]);

  const setAvailable = async (isAvailable: boolean) => {
    try {
      await api.patch('/riders/me', { isAvailable });
      setDashboard((d) => (d ? { ...d, isAvailable } : null));
    } catch {
      // ignore
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
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

  const active = orders.filter((o) => ['RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP'].includes(o.orderStatus));
  const sortOrder = (a: Order, b: Order) => {
    const prio: Record<string, number> = { RIDER_ACCEPTED: 0, PICKED_UP: 1, RIDER_ASSIGNED: 2 };
    return (prio[a.orderStatus] ?? 99) - (prio[b.orderStatus] ?? 99);
  };
  const sortedActive = [...active].sort(sortOrder);
  const activeOrder = sortedActive[0];
  const assignedOrders = sortedActive.slice(1);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Rider Dashboard" />
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
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
      <ContentPanel>
        <main className="max-w-lg mx-auto px-4 py-4">
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

              <div className="grid grid-cols-2 gap-3 mb-6">
                <Card className="p-4">
                  <p className="text-xs text-slate-500 uppercase">Today Earnings</p>
                  <p className="text-xl font-bold text-accent mt-1">
                    {loading ? '—' : `${Number(dashboard?.todayEarnings ?? 0).toLocaleString()} PKR`}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-slate-500 uppercase">Completed</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{loading ? '—' : dashboard?.completedToday ?? 0}</p>
                </Card>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activeOrder ? (
                <Card className="mb-6 border-2 border-primary/40 overflow-hidden">
                  <div className="bg-primary/5 px-4 py-3 border-b border-slate-200">
                    <p className="text-sm font-bold text-primary">ACTIVE ORDER</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <p className="font-bold text-lg text-slate-800">Order #{activeOrder.id.slice(-8).toUpperCase()}</p>
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
                    <div className="flex gap-3 pt-2">
                      {activeOrder.orderStatus === 'RIDER_ASSIGNED' && (
                        <>
                          <Button
                            size="lg"
                            fullWidth
                            loading={actionLoading === activeOrder.id}
                            onClick={() => updateStatus(activeOrder.id, 'RIDER_ACCEPTED')}
                          >
                            <Check className="w-5 h-5 mr-2 inline" /> Accept Order
                          </Button>
                          <Button
                            size="lg"
                            variant="outline"
                            disabled={!!actionLoading}
                            onClick={() => updateStatus(activeOrder.id, 'READY_FOR_PICKUP')}
                          >
                            <X className="w-5 h-5" />
                          </Button>
                        </>
                      )}
                      {activeOrder.orderStatus === 'RIDER_ACCEPTED' && (
                        <>
                          <a
                            href={googleMapsUrl(activeOrder.store?.latitude, activeOrder.store?.longitude, activeOrder.store?.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1"
                          >
                            <Button variant="outline" size="lg" fullWidth>
                              <MapPin className="w-5 h-5 mr-2 inline" /> Navigate to Store
                            </Button>
                          </a>
                          <Button
                            size="lg"
                            fullWidth
                            loading={actionLoading === activeOrder.id}
                            onClick={() => updateStatus(activeOrder.id, 'PICKED_UP')}
                          >
                            Mark Picked Up
                          </Button>
                        </>
                      )}
                      {activeOrder.orderStatus === 'PICKED_UP' && (
                        <>
                          <a
                            href={googleMapsUrl(activeOrder.address?.latitude, activeOrder.address?.longitude, activeOrder.address?.fullAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1"
                          >
                            <Button variant="outline" size="lg" fullWidth>
                              <MapPin className="w-5 h-5 mr-2 inline" /> Navigate to Customer
                            </Button>
                          </a>
                          <Button
                            size="lg"
                            fullWidth
                            loading={actionLoading === activeOrder.id}
                            onClick={() => updateStatus(activeOrder.id, 'DELIVERED')}
                          >
                            Mark Delivered
                          </Button>
                        </>
                      )}
                    </div>
                    <Link href={`/rider/orders/${activeOrder.id}`} className="block text-center text-sm text-primary">
                      View full details
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card className="mb-6 py-12 text-center">
                  <Package className="w-16 h-16 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-slate-600 font-medium">No active order</p>
                  <p className="text-slate-500 text-sm mt-1">Admin will assign you orders when ready.</p>
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
                </>
              ) : (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </main>
      </ContentPanel>
    </div>
  );
}
