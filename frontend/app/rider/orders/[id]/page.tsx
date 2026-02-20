'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Phone,
  Banknote,
  CreditCard,
  ExternalLink,
  Check,
  X,
  Package,
} from 'lucide-react';
import api from '@/services/api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  STORE_ACCEPTED: 'Accepted by store',
  STORE_REJECTED: 'Rejected',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Assigned to you',
  RIDER_ACCEPTED: 'Accepted',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

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

interface OrderDetail {
  id: string;
  orderStatus: string;
  totalAmount: number;
  paymentMethod?: string;
  store?: { name: string; address?: string; latitude?: number; longitude?: number; phone?: string };
  customer?: { name: string; phone: string };
  address?: { fullAddress: string; latitude?: number; longitude?: number };
  statusHistory?: { status: string; createdAt: string }[];
  allowedTransitions?: string[];
  items: { product: { name: string }; quantity: number; price: number }[];
}

export default function RiderOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    const id = params?.id;
    if (id) {
      api.get<OrderDetail>(`/orders/${id}`)
        .then((r) => setOrder(r.data))
        .catch(() => setOrder(null));
    }
  }, [token, router, params?.id]);

  const updateStatus = async (status: string) => {
    if (!order) return;
    setLoading(true);
    try {
      await api.patch(`/orders/${order.id}/status`, { status });
      const res = await api.get<OrderDetail>(`/orders/${order.id}`);
      setOrder(res.data);
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <StickyHeader title="Order" backHref="/rider/dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const allowed = order.allowedTransitions ?? [];
  const formatDate = (d: string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title={`Order #${order.id.slice(-8)}`} backHref="/rider/dashboard" />
      <ContentPanel>
        <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-600 uppercase mb-3">Timeline</p>
            <div className="space-y-2">
              {order.statusHistory?.map((h, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm shrink-0">
                    {h.status === 'CANCELLED' || h.status === 'STORE_REJECTED' ? '✕' : '✔'}
                  </div>
                  <div>
                    <p className="font-medium">{STATUS_LABELS[h.status] ?? h.status}</p>
                    <p className="text-xs text-slate-500">{formatDate(h.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-600 uppercase mb-3">Store</p>
            <p className="font-semibold">{order.store?.name ?? 'Store'}</p>
            <p className="text-sm text-slate-600">{order.store?.address ?? '—'}</p>
            {order.store?.phone && (
              <a href={`tel:${order.store.phone}`} className="flex items-center gap-2 text-primary mt-2">
                <Phone className="w-4 h-4" /> {order.store.phone}
              </a>
            )}
            <a
              href={googleMapsUrl(order.store?.latitude, order.store?.longitude, order.store?.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary mt-2"
            >
              <ExternalLink className="w-4 h-4" /> Open in Google Maps
            </a>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-600 uppercase mb-3">Customer</p>
            <p className="font-semibold">{order.customer?.name ?? 'Customer'}</p>
            <p className="text-sm text-slate-600">{order.address?.fullAddress ?? '—'}</p>
            {order.customer?.phone && (
              <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-primary mt-2">
                <Phone className="w-4 h-4" /> {order.customer.phone}
              </a>
            )}
            <a
              href={googleMapsUrl(order.address?.latitude, order.address?.longitude, order.address?.fullAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary mt-2"
            >
              <ExternalLink className="w-4 h-4" /> Open in Google Maps
            </a>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-600 uppercase mb-2">Items</p>
            {order.items.map((i, idx) => (
              <div key={idx} className="flex justify-between py-1 text-sm">
                <span>{i.product.name} × {Number(i.quantity)}</span>
                <span>Rs {(Number(i.quantity) * Number(i.price)).toFixed(0)}</span>
              </div>
            ))}
          </Card>

          <Card className="p-4">
            {order.paymentMethod === 'COD' ? (
              <p className="font-bold text-accent text-lg">
                <Banknote className="w-5 h-5 inline mr-2" />
                Amount to collect: {Number(order.totalAmount).toLocaleString()} PKR
              </p>
            ) : (
              <p className="font-medium text-green-700">
                <CreditCard className="w-5 h-5 inline mr-2" />
                Paid (no collection needed)
              </p>
            )}
          </Card>

          {allowed.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-600 uppercase mb-3">Action</p>
              <div className="space-y-2">
                {allowed.includes('RIDER_ACCEPTED') && (
                  <div className="flex gap-2">
                    <Button size="lg" fullWidth loading={loading} onClick={() => updateStatus('RIDER_ACCEPTED')}>
                      <Check className="w-5 h-5 mr-2" /> Accept Order
                    </Button>
                    <Button size="lg" variant="outline" disabled={loading} onClick={() => updateStatus('READY_FOR_PICKUP')}>
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                )}
                {allowed.includes('PICKED_UP') && (
                  <Button size="lg" fullWidth loading={loading} onClick={() => updateStatus('PICKED_UP')}>
                    <Package className="w-5 h-5 mr-2" /> Mark Picked Up
                  </Button>
                )}
                {allowed.includes('DELIVERED') && (
                  <Button size="lg" fullWidth loading={loading} onClick={() => updateStatus('DELIVERED')}>
                    Mark Delivered
                  </Button>
                )}
              </div>
            </Card>
          )}
        </main>
      </ContentPanel>
    </div>
  );
}
