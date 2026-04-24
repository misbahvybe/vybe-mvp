'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';
import { useAdminOrdersRefresh } from '@/hooks/useAdminOrdersRefresh';
import { formatOrderNo } from '@/lib/orderDisplay';

interface Order {
  id: string;
  orderNumber?: number;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  commissionAmount?: number;
  riderSelfAssigned?: boolean;
  paymentMethod?: string;
  paymentStatus?: string;
  store?: { name: string };
  customer?: { name: string; phone: string };
  rider?: { name: string; phone: string } | null;
  address?: { fullAddress: string };
  items: { product: { name: string }; quantity: number; price: number }[];
}

interface Rider {
  id: string;
  name: string;
  phone: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  STORE_ACCEPTED: 'Preparing',
  STORE_REJECTED: 'Rejected',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Captain assigned',
  RIDER_ACCEPTED: 'Accepted',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const OUT_FOR_DELIVERY = ['RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP'];

function AdminOrdersContent() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams?.get('status') ?? '';
  const payFilter = searchParams?.get('pay') ?? '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    api.get<Order[]>('/orders').then((r) => setOrders(r.data ?? [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
    api
      .get<Rider[]>('/orders/riders/list')
      .then((r) => setRiders(r.data ?? []))
      .catch(() => setRiders([]));
  }, [fetchOrders]);

  useAdminOrdersRefresh(fetchOrders);

  const filtered = orders.filter((o) => {
    if (payFilter === 'verify') {
      return o.paymentStatus === 'PENDING_VERIFICATION' && o.paymentMethod === 'MANUAL_TRANSFER';
    }
    if (!statusFilter) return true;
    if (statusFilter === 'out_for_delivery') return OUT_FOR_DELIVERY.includes(o.orderStatus);
    return o.orderStatus === statusFilter;
  });

  const formatDate = (d: string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });

  const handleReassign = async (order: Order) => {
    if (riders.length === 0) {
      alert('No active captains available to assign.');
      return;
    }
    const options = riders
      .map((r, idx) => `${idx + 1}) ${r.name} (${r.phone})`)
      .join('\n');
    const input = prompt(
      `Select new captain for order ${formatOrderNo(order.orderNumber, order.id)}:\n${options}\n\nEnter number (1-${riders.length}):`,
    );
    if (!input) return;
    const index = Number(input) - 1;
    if (Number.isNaN(index) || index < 0 || index >= riders.length) {
      alert('Invalid selection');
      return;
    }
    const rider = riders[index];
    const reason = prompt('Optional reason for reassignment', '');
    setReassigningId(order.id);
    try {
      await api.patch(`/orders/${order.id}/reassign-rider`, {
        riderId: rider.id,
        reason: reason || undefined,
      });
      fetchOrders();
    } catch (e) {
      alert(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to reassign captain',
      );
    } finally {
      setReassigningId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Orders</h1>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <span className="text-slate-600">Quick filters:</span>
        <Link href="/admin/orders" className="text-primary underline">All</Link>
        <Link href="/admin/orders?pay=verify" className="text-primary font-medium">Payment to verify (MVP)</Link>
        {statusFilter && (
          <span className="text-slate-500">
            · Status: {statusFilter === 'out_for_delivery' ? 'Out for delivery' : STATUS_LABELS[statusFilter] ?? statusFilter}
          </span>
        )}
        {payFilter === 'verify' && <span className="text-slate-500">· Manual payments awaiting review</span>}
      </div>
      {statusFilter && !payFilter && (
        <p className="text-sm text-slate-600 mb-4">Filtered by: {statusFilter === 'out_for_delivery' ? 'Out for delivery' : STATUS_LABELS[statusFilter] ?? statusFilter}</p>
      )}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader size={44} className="mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium">Order</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Store</th>
                  <th className="text-left p-3 font-medium">Captain</th>
                  <th className="text-left p-3 font-medium">Pick</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Pay</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-right p-3 font-medium">Commission</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{formatOrderNo(o.orderNumber, o.id)}</td>
                    <td className="p-3">{o.customer?.name ?? '—'}</td>
                    <td className="p-3">{o.store?.name ?? '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{o.rider?.name ?? '—'}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReassign(o)}
                          disabled={!!reassigningId}
                        >
                          {reassigningId === o.id ? 'Changing...' : 'Change'}
                        </Button>
                      </div>
                    </td>
                    <td className="p-3">
                      {o.riderSelfAssigned ? (
                        <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          Self-pick
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        o.orderStatus === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                        o.orderStatus === 'CANCELLED' || o.orderStatus === 'STORE_REJECTED' ? 'bg-red-100 text-red-800' :
                        o.orderStatus === 'READY_FOR_PICKUP' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {STATUS_LABELS[o.orderStatus] ?? o.orderStatus}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-600 max-w-[120px]">
                      {o.paymentMethod === 'MANUAL_TRANSFER' ? 'Manual' : o.paymentMethod ?? '—'}
                      {o.paymentStatus && (
                        <span className="block text-amber-800">{o.paymentStatus === 'PENDING_VERIFICATION' ? 'Review' : o.paymentStatus}</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium">Rs {Number(o.totalAmount).toLocaleString()}</td>
                    <td className="p-3 text-right">Rs {Number(o.commissionAmount ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-slate-500">{formatDate(o.createdAt)}</td>
                    <td className="p-3">
                      <Link href={`/order/${o.id}`} className="text-primary font-medium">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length === 0 && !loading && <p className="p-8 text-center text-slate-500">No orders</p>}
      </Card>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center">
          <Loader size={44} className="mx-auto" />
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
