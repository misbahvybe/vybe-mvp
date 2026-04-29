'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';
import { useAdminOrdersRefresh } from '@/hooks/useAdminOrdersRefresh';
import { formatOrderNo } from '@/lib/orderDisplay';
import { getApiErrorMessage } from '@/lib/apiError';

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
  const [opsHealth, setOpsHealth] = useState<{
    posAutoAcceptEnabled: boolean;
    posAutoAcceptFromDatabase?: boolean;
    posAutoAcceptFromEnv?: boolean;
    stalePendingMinutes: number;
    stalePendingCount: number;
    paymentProofQueueCount: number;
  } | null>(null);
  const [posAutoSaving, setPosAutoSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const listHeaderCheckboxRef = useRef<HTMLInputElement>(null);

  const fetchOpsHealth = useCallback(() => {
    api
      .get<{
        posAutoAcceptEnabled: boolean;
        posAutoAcceptFromDatabase?: boolean;
        posAutoAcceptFromEnv?: boolean;
        stalePendingMinutes: number;
        stalePendingCount: number;
        paymentProofQueueCount: number;
      }>('/orders/admin/health')
      .then((r) => setOpsHealth(r.data ?? null))
      .catch(() => setOpsHealth(null));
  }, []);

  const fetchOrders = useCallback(() => {
    api.get<Order[]>('/orders').then((r) => setOrders(r.data ?? [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  const fetchOrdersAndHealth = useCallback(() => {
    fetchOpsHealth();
    fetchOrders();
  }, [fetchOpsHealth, fetchOrders]);

  useEffect(() => {
    fetchOrdersAndHealth();
    api
      .get<Rider[]>('/orders/riders/list')
      .then((r) => setRiders(r.data ?? []))
      .catch(() => setRiders([]));
  }, [fetchOrdersAndHealth]);

  useAdminOrdersRefresh(fetchOrdersAndHealth);

  const filtered = orders.filter((o) => {
    if (payFilter === 'verify') {
      return o.paymentStatus === 'PENDING_VERIFICATION' && o.paymentMethod === 'MANUAL_TRANSFER';
    }
    if (!statusFilter) return true;
    if (statusFilter === 'out_for_delivery') return OUT_FOR_DELIVERY.includes(o.orderStatus);
    return o.orderStatus === statusFilter;
  });

  const filteredIdsKey = filtered.map((o) => o.id).join(',');

  useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(filtered.map((o) => o.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [filteredIdsKey]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((o) => o.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));
  const someFilteredSelected = filtered.some((o) => selectedIds.has(o.id));

  useEffect(() => {
    const el = listHeaderCheckboxRef.current;
    if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  const handleHardDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setPurgeMessage(null);
    const ok = window.confirm(
      `Permanently delete ${ids.length} order(s) from the database? Stock will be restored. Delivered COD orders cannot be removed this way.\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const { data } = await api.post<{ deletedCount: number; deletedIds: string[] }>('/orders/admin/hard-delete', {
        orderIds: ids,
      });
      setPurgeMessage({
        type: 'ok',
        text: `Removed ${data?.deletedCount ?? 0} order(s).`,
      });
      clearSelection();
      fetchOrdersAndHealth();
    } catch (e: unknown) {
      setPurgeMessage({ type: 'err', text: getApiErrorMessage(e, 'Delete failed') });
    } finally {
      setDeleting(false);
    }
  };

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
      fetchOrdersAndHealth();
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
      {opsHealth && (
        <Card className="mb-4 p-4 border-slate-200">
          <p className="text-sm font-semibold text-slate-800 mb-2">Pipeline snapshot</p>
          <div className="text-sm text-slate-600 mb-4 pb-4 border-b border-slate-100">
            <span className="font-medium text-slate-800">Store POS auto-accept (all stores)</span>
            <div className="mt-1 space-y-1">
              <p>
                Effective:{' '}
                <span className={opsHealth.posAutoAcceptEnabled ? 'text-emerald-700 font-semibold' : 'text-slate-600'}>
                  {opsHealth.posAutoAcceptEnabled ? 'On' : 'Off'}
                </span>
                {opsHealth.posAutoAcceptEnabled
                  ? ' — new orders skip Accept and go to Preparing (COD / paid paths as today).'
                  : ' — stores must tap Accept/Reject on pending orders.'}
              </p>
              <p className="text-xs">
                Database: {opsHealth.posAutoAcceptFromDatabase === true ? 'On' : 'Off'}
                {' · '}
                Env <code className="text-[11px] bg-slate-100 px-1 rounded">VYBE_POS_AUTO_ACCEPT_ORDERS</code>:{' '}
                {opsHealth.posAutoAcceptFromEnv === true ? 'On (override)' : 'Off'}
              </p>
              {opsHealth.posAutoAcceptFromEnv === true ? (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Env is forcing auto-accept on. Remove it from the API host to allow “Off” when the database flag is
                  off.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={opsHealth.posAutoAcceptFromDatabase === true ? 'secondary' : 'primary'}
                  loading={posAutoSaving}
                  disabled={posAutoSaving}
                  onClick={async () => {
                    const next = opsHealth.posAutoAcceptFromDatabase !== true;
                    if (
                      !next &&
                      opsHealth.posAutoAcceptFromEnv === true &&
                      !window.confirm(
                        'Database flag will be off, but VYBE_POS_AUTO_ACCEPT_ORDERS is still set on the server, so auto-accept will stay ON until you remove that env. Continue?',
                      )
                    ) {
                      return;
                    }
                    setPosAutoSaving(true);
                    try {
                      await api.patch('/admin/pricing/checkout-settings', { posAutoAcceptOrders: next });
                      await fetchOpsHealth();
                    } catch (e) {
                      alert(
                        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                          'Could not update auto-accept',
                      );
                    } finally {
                      setPosAutoSaving(false);
                    }
                  }}
                >
                  {opsHealth.posAutoAcceptFromDatabase === true
                    ? 'Turn off (saved in database)'
                    : 'Turn on for all stores'}
                </Button>
              </div>
            </div>
          </div>
          <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
            <li>
              Stuck PENDING longer than {opsHealth.stalePendingMinutes} minutes:{' '}
              <span className={opsHealth.stalePendingCount > 0 ? 'text-amber-800 font-semibold' : ''}>
                {opsHealth.stalePendingCount}
              </span>
              {opsHealth.stalePendingCount > 0 ? (
                <>
                  {' '}
                  <Link className="text-primary font-medium" href="/admin/orders?status=PENDING">
                    View filter
                  </Link>
                </>
              ) : null}
            </li>
            <li>
              Manual payment proof queue:{' '}
              <span className={opsHealth.paymentProofQueueCount > 0 ? 'text-amber-800 font-semibold' : ''}>
                {opsHealth.paymentProofQueueCount}
              </span>
              {opsHealth.paymentProofQueueCount > 0 ? (
                <>
                  {' '}
                  <Link className="text-primary font-medium" href="/admin/orders?pay=verify">
                    Review
                  </Link>
                </>
              ) : null}
            </li>
          </ul>
        </Card>
      )}
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
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 max-w-3xl">
          <span className="font-medium text-slate-800">Test data cleanup:</span> tick rows, then delete permanently from the
          database (inventory is restored).{' '}
          <span className="text-amber-800">Delivered cash-on-delivery orders cannot be removed here</span> (rider cash
          accounting).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedIds.size === 0 || deleting}
            onClick={clearSelection}
          >
            Clear selection
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={deleting}
            disabled={selectedIds.size === 0 || deleting}
            onClick={handleHardDeleteSelected}
          >
            Delete selected ({selectedIds.size})
          </Button>
        </div>
      </div>
      {purgeMessage && (
        <p
          className={`mb-3 text-sm rounded-lg px-3 py-2 ${
            purgeMessage.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {purgeMessage.text}
        </p>
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
                  <th className="w-11 p-2 text-center">
                    <span className="sr-only">Select for delete</span>
                    <input
                      ref={listHeaderCheckboxRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 align-middle"
                      checked={allFilteredSelected}
                      disabled={filtered.length === 0 || loading}
                      onChange={() => {
                        if (allFilteredSelected) clearSelection();
                        else selectAllFiltered();
                      }}
                      aria-label="Select all orders in the current list"
                    />
                  </th>
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
                    <td className="p-2 text-center align-middle w-11">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelect(o.id)}
                        aria-label={`Select order ${formatOrderNo(o.orderNumber, o.id)}`}
                      />
                    </td>
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
