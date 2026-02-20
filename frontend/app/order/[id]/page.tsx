'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';

interface OrderDetail {
  id: string;
  orderStatus: string;
  cancellationReason?: string | null;
  createdAt: string;
  totalAmount: number;
  store?: { name: string };
  address?: { fullAddress: string };
  rider?: { name: string; phone: string } | null;
  statusHistory?: { status: string; createdAt: string; changedByUserId: string | null }[];
  allowedTransitions?: string[];
  items: { product: { name: string }; quantity: number; price: number }[];
}

const CANCELLATION_LABELS: Record<string, string> = {
  CUSTOMER_CANCELLED: 'Customer cancelled',
  STORE_REJECTED: 'Store rejected',
  ADMIN_CANCELLED: 'Admin cancelled',
  OUT_OF_STOCK: 'Out of stock',
  STORE_CLOSED: 'Store closed',
  OTHER: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  STORE_ACCEPTED: 'Accepted by store',
  STORE_REJECTED: 'Rejected by store',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Rider assigned',
  RIDER_ACCEPTED: 'Rider accepted',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function getBackHref(role: string): string {
  if (role === 'ADMIN') return '/admin/orders';
  if (role === 'STORE_OWNER') return '/store/dashboard';
  if (role === 'RIDER') return '/rider/dashboard';
  return '/orders';
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [riderId, setRiderId] = useState('');
  const [riders, setRiders] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [cancelReason, setCancelReason] = useState('');

  const fetchOrder = () => {
    const id = params?.id;
    if (!id) return;
    api.get<OrderDetail>(`/orders/${id}`).then((res) => setOrder(res.data)).catch(() => setOrder(null));
  };

  const notFound = order === null && token;

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    fetchOrder();
    if (user?.role === 'ADMIN') {
      api.get<{ id: string; name: string; phone: string }[]>('/orders/riders/list').then((res) => setRiders(res.data ?? [])).catch(() => {});
    }
  }, [token, router, params?.id, user?.role]);

  const updateStatus = async (status: string, extra?: { riderId?: string; cancellationReason?: string }) => {
    if (!order) return;
    setLoading(true);
    try {
      await api.patch(`/orders/${order.id}/status`, { status, ...extra });
      fetchOrder();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <StickyHeader title="Order" backHref={getBackHref(user?.role ?? 'CUSTOMER')} />
        <div className="flex-1 flex items-center justify-center px-4">
          {notFound ? (
            <p className="text-slate-600">Order not found or you don&apos;t have access.</p>
          ) : (
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const allowed = order.allowedTransitions ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Order details" backHref={getBackHref(user?.role ?? 'CUSTOMER')} />
      <ContentPanel bottomPadding="sm">
      <main className="max-w-lg mx-auto px-4 py-4">
        <Card className="mb-4">
          <p className="text-slate-600 text-sm">Order #{order.id.slice(-8)}</p>
          <p className="font-semibold text-slate-800">{order.store?.name}</p>
          <p className="text-sm text-slate-500">{formatDate(order.createdAt)}</p>
          <span className={`inline-block mt-2 px-3 py-1 rounded-pill text-xs font-medium ${
            order.orderStatus === 'DELIVERED' ? 'bg-green-100 text-green-800' :
            order.orderStatus === 'CANCELLED' || order.orderStatus === 'STORE_REJECTED' ? 'bg-red-100 text-red-800' :
            'bg-slate-200 text-slate-600'
          }`}>
            {STATUS_LABELS[order.orderStatus] ?? order.orderStatus}
          </span>
          {order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'STORE_REJECTED' && (
            <p className="text-xs text-slate-500 mt-2">Expected delivery: 90–120 minutes</p>
          )}
          {order.cancellationReason && (
            <p className="text-sm text-red-600 mt-2">Reason: {CANCELLATION_LABELS[order.cancellationReason] ?? order.cancellationReason}</p>
          )}
        </Card>

        {allowed.length > 0 && (
          <Card className="mb-4">
            <p className="font-semibold text-slate-800 mb-2">Actions</p>
            <div className="space-y-2">
              {allowed.includes('RIDER_ASSIGNED') && (
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={riderId}
                    onChange={(e) => setRiderId(e.target.value)}
                    className="flex-1 min-w-[120px] px-3 py-2 rounded-button border border-slate-300"
                  >
                    <option value="">Select rider</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>
                    ))}
                  </select>
                  <Button size="sm" disabled={!riderId || loading} onClick={() => updateStatus('RIDER_ASSIGNED', { riderId })}>
                    Assign Rider
                  </Button>
                </div>
              )}
              {allowed.includes('CANCELLED') && (user?.role === 'ADMIN' || user?.role === 'CUSTOMER') && (
                <div className="flex gap-2 items-center flex-wrap">
                  {user?.role === 'ADMIN' && (
                    <select
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="flex-1 min-w-[180px] px-3 py-2 rounded-button border border-slate-300"
                    >
                      <option value="">Select reason (optional)</option>
                      {Object.entries(CANCELLATION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  )}
                  <Button variant="outline" size="sm" disabled={loading} onClick={() => updateStatus('CANCELLED', user?.role === 'ADMIN' && cancelReason ? { cancellationReason: cancelReason } : undefined)}>
                    Cancel order
                  </Button>
                </div>
              )}
              {['STORE_ACCEPTED', 'STORE_REJECTED', 'READY_FOR_PICKUP', 'RIDER_ACCEPTED', 'PICKED_UP', 'DELIVERED']
                .filter((s) => allowed.includes(s) && s !== 'RIDER_ASSIGNED' && s !== 'CANCELLED')
                .map((status) => (
                  <Button key={status} size="sm" disabled={loading} onClick={() => updateStatus(status)} className="mr-2 mb-2">
                    {STATUS_LABELS[status]}
                  </Button>
                ))}
            </div>
          </Card>
        )}

        {order.address && (
          <Card className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-1">Delivery address</p>
            <p className="text-slate-600 text-sm">{order.address.fullAddress}</p>
          </Card>
        )}
        {order.rider && (
          <Card className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-1">Rider</p>
            <p className="text-slate-600 text-sm">{order.rider.name} – {order.rider.phone}</p>
          </Card>
        )}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <Card className="mb-4">
            <p className="font-semibold text-slate-800 mb-4">Order progress</p>
            <div className="space-y-3">
              {order.statusHistory.map((h, idx) => {
                const isLast = idx === order.statusHistory!.length - 1;
                return (
                  <div key={`${h.status}-${idx}`} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-medium ${
                      isLast && (h.status === 'CANCELLED' || h.status === 'STORE_REJECTED') ? 'bg-red-100 text-red-700' : 'bg-primary text-white'
                    }`}>
                      {h.status === 'CANCELLED' || h.status === 'STORE_REJECTED' ? '✕' : '✔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${isLast ? 'text-primary' : 'text-slate-700'}`}>
                        {STATUS_LABELS[h.status] ?? h.status}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(h.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <Card>
          <p className="font-semibold text-slate-800 mb-2">Products</p>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-slate-800">{item.product.name} × {Number(item.quantity)}</span>
              <span className="text-accent font-medium">Rs {(Number(item.quantity) * Number(item.price)).toFixed(0)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-3 font-bold text-slate-800">
            <span>Total</span>
            <span className="text-accent">Rs {Number(order.totalAmount).toFixed(0)}</span>
          </div>
        </Card>
      </main>
      </ContentPanel>
    </div>
  );
}
