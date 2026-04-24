'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';
import { useOrderDetailRealtime } from '@/hooks/useOrdersRealtime';
import { formatOrderNo } from '@/lib/orderDisplay';

interface OrderDetail {
  id: string;
  orderNumber?: number;
  orderStatus: string;
  cancellationReason?: string | null;
  createdAt: string;
  totalAmount: number;
  subtotalAmount?: number;
  deliveryFee?: number;
  serviceFee?: number;
  gstAmount?: number;
  cardProcessingAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentScreenshotUrl?: string | null;
  manualTransferProvider?: string | null;
  slaDeadlineAt?: string | null;
  store?: { name: string };
  address?: { fullAddress: string };
  rider?: { name: string; phone: string } | null;
  statusHistory?: { status: string; createdAt: string; changedByUserId: string | null }[];
  allowedTransitions?: string[];
  items: { id: string; product: { name: string }; quantity: number; price: number }[];
}

function SlaCountdown({ deadlineIso }: { deadlineIso: string | null | undefined }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (!deadlineIso) {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(new Date(deadlineIso).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);
  if (!deadlineIso || remainingMs === null) return null;
  if (remainingMs <= 0) {
    return (
      <p className="text-amber-800 text-sm mt-2 font-medium">
        SLA target time has passed — contact support if the order is still open.
      </p>
    );
  }
  const m = Math.floor(remainingMs / 60000);
  const s = Math.floor((remainingMs % 60000) / 1000);
  return (
    <p className="text-sm text-slate-600 mt-2">
      Target completion: {new Date(deadlineIso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}{' '}
      <span className="text-primary font-medium tabular-nums">
        ({m}m {s}s left)
      </span>
    </p>
  );
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
  RIDER_ASSIGNED: 'Captain assigned',
  RIDER_ACCEPTED: 'Captain accepted',
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
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [order, setOrder] = useState<OrderDetail | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [riderId, setRiderId] = useState('');
  const [riders, setRiders] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [mvpHints, setMvpHints] = useState<Record<string, { accountNumber: string; accountTitle: string; openAppUrl: string | null } | null> | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const wideOrderShell = Boolean(user?.role && user.role !== 'CUSTOMER');

  const orderIdParam = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const fetchOrder = useCallback(() => {
    if (!orderIdParam) return;
    setOrder(undefined);
    api
      .get<OrderDetail>(`/orders/${orderIdParam}`)
      .then((res) => setOrder(res.data))
      .catch(() => setOrder(null));
  }, [orderIdParam]);

  const notFound = order === null && !!token;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    fetchOrder();
    if (user?.role === 'ADMIN') {
      api.get<{ id: string; name: string; phone: string }[]>('/orders/riders/list').then((res) => setRiders(res.data ?? [])).catch(() => {});
    }
  }, [hasHydrated, token, router, orderIdParam, user?.role, fetchOrder]);

  useOrderDetailRealtime(!!token && !!orderIdParam, orderIdParam, token, fetchOrder, 30000);

  useEffect(() => {
    if (order?.paymentMethod === 'MANUAL_TRANSFER') {
      api
        .get<{
          mvpAccountHints: Record<string, { accountNumber: string; accountTitle: string; openAppUrl: string | null } | null> | null;
        }>('/orders/checkout/eligibility')
        .then((r) => setMvpHints(r.data?.mvpAccountHints ?? null))
        .catch(() => setMvpHints(null));
    }
  }, [order?.paymentMethod, orderIdParam]);

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

  if (order == null) {
    return (
      <div className="min-h-screen flex flex-col">
        <StickyHeader title="Order" backHref={getBackHref(user?.role ?? 'CUSTOMER')} wideShell={wideOrderShell} />
        <ContentPanel bottomPadding="sm">
          <main className={`${wideOrderShell ? 'app-shell-wide' : 'app-shell-narrow'} py-8 flex items-center justify-center`}>
            {order === null && notFound ? (
              <div className="text-center">
                <p className="text-slate-700 font-medium">Order not found</p>
                <p className="text-sm text-slate-600 mt-1">It may be cancelled, deleted, or you don&apos;t have access.</p>
                <Button className="mt-4" variant="outline" onClick={() => router.replace(getBackHref(user?.role ?? 'CUSTOMER'))}>
                  Go back
                </Button>
              </div>
            ) : (
              <Loader size={44} />
            )}
          </main>
        </ContentPanel>
      </div>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const allowed = order.allowedTransitions ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Order details" backHref={getBackHref(user?.role ?? 'CUSTOMER')} wideShell={wideOrderShell} />
      <ContentPanel bottomPadding="sm">
      <main className={`${wideOrderShell ? 'app-shell-wide' : 'app-shell-narrow'} py-4`}>
        <Card className="mb-4">
          <p className="text-slate-600 text-sm">Order {formatOrderNo(order.orderNumber, order.id)}</p>
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
            <>
              <p className="text-xs text-slate-500 mt-2">Fast delivery</p>
              <SlaCountdown deadlineIso={order.slaDeadlineAt} />
            </>
          )}
          {order.cancellationReason && (
            <p className="text-sm text-red-600 mt-2">Reason: {CANCELLATION_LABELS[order.cancellationReason] ?? order.cancellationReason}</p>
          )}
        </Card>

        {user?.role === 'CUSTOMER' && order.paymentMethod === 'MANUAL_TRANSFER' && order.orderStatus === 'PENDING' && order.paymentStatus === 'PENDING' && (
          <Card className="mb-4 border-primary/30">
            <p className="font-semibold text-slate-800 mb-2">Complete payment (exact amount)</p>
            <p className="text-2xl font-bold text-primary mb-3">Rs {Number(order.totalAmount).toFixed(0)}</p>
            {order.manualTransferProvider && mvpHints && (() => {
              const p = order.manualTransferProvider;
              const h = p ? mvpHints[p] : null;
              if (!h) {
                return <p className="text-sm text-amber-800">Account details are not configured. Contact support with your order number.</p>;
              }
              return (
                <div className="text-sm space-y-1 mb-4">
                  <p><span className="text-slate-500">Account title:</span> {h.accountTitle}</p>
                  <p><span className="text-slate-500">Account / number:</span> {h.accountNumber}</p>
                </div>
              );
            })()}
            {mvpHints && order.manualTransferProvider && mvpHints[order.manualTransferProvider]?.openAppUrl && (
              <a
                href={mvpHints[order.manualTransferProvider]!.openAppUrl!}
                target="_blank"
                rel="noreferrer"
                className="inline-block mb-4 text-sm text-primary font-medium underline"
              >
                Open {order.manualTransferProvider === 'BANK_MANUAL' ? 'banking' : 'wallet'} app
              </a>
            )}
            <p className="text-sm text-slate-600 mb-2">After paying, upload a clear screenshot of the transfer.</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="text-sm w-full"
              disabled={uploadingProof}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !order) return;
                setUploadingProof(true);
                const fd = new FormData();
                fd.append('file', f);
                try {
                  await api.post(`/orders/${order.id}/payment-screenshot`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  await fetchOrder();
                } catch (err) {
                  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed';
                  alert(msg);
                } finally {
                  setUploadingProof(false);
                  e.target.value = '';
                }
              }}
            />
            {uploadingProof && <p className="text-xs text-slate-500 mt-1">Uploading…</p>}
          </Card>
        )}

        {user?.role === 'CUSTOMER' && order.paymentMethod === 'MANUAL_TRANSFER' && order.paymentStatus === 'PENDING_VERIFICATION' && (
          <Card className="mb-4 bg-slate-50">
            <p className="text-sm text-slate-800 font-medium">Payment received — we are reviewing your screenshot. The store is notified only after approval.</p>
            {order.paymentScreenshotUrl && (
              <a href={order.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline mt-2 inline-block">
                View your uploaded image
              </a>
            )}
          </Card>
        )}

        {user?.role === 'ADMIN' && order.paymentMethod === 'MANUAL_TRANSFER' && order.paymentStatus === 'PENDING_VERIFICATION' && (
          <Card className="mb-4 border-amber-200 bg-amber-50/80">
            <p className="font-semibold text-amber-950 mb-2">Verify manual payment</p>
            {order.paymentScreenshotUrl && (
              <a
                href={order.paymentScreenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary font-medium underline mb-4 block"
              >
                Open customer screenshot
              </a>
            )}
            <p className="text-sm text-slate-800 mb-2">Total: Rs {Number(order.totalAmount).toFixed(0)} · {order.manualTransferProvider}</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="primary"
                disabled={verifyBusy}
                onClick={async () => {
                  if (!order) return;
                  setVerifyBusy(true);
                  try {
                    await api.post(`/orders/${order.id}/verify-manual-payment`, { decision: 'approve' });
                    await fetchOrder();
                  } catch (e) {
                    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed';
                    alert(msg);
                  } finally {
                    setVerifyBusy(false);
                  }
                }}
              >
                Approve (mark paid)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={verifyBusy}
                onClick={async () => {
                  if (!order) return;
                  if (!window.confirm('Reject payment and cancel this order?')) return;
                  setVerifyBusy(true);
                  try {
                    await api.post(`/orders/${order.id}/verify-manual-payment`, { decision: 'reject' });
                    await fetchOrder();
                  } catch (e) {
                    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed';
                    alert(msg);
                  } finally {
                    setVerifyBusy(false);
                  }
                }}
              >
                Reject (cancel order)
              </Button>
            </div>
          </Card>
        )}

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
                    <option value="">Select captain</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>
                    ))}
                  </select>
                  <Button size="sm" disabled={!riderId || loading} onClick={() => updateStatus('RIDER_ASSIGNED', { riderId })}>
                    Assign Captain
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
            <p className="text-sm font-medium text-slate-700 mb-1">Captain</p>
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
          {order.items.map((item) => {
            const canEditItems =
              (user?.role === 'ADMIN' || user?.role === 'STORE_OWNER') &&
              (order.orderStatus === 'PENDING' || order.orderStatus === 'STORE_ACCEPTED');
            const lineTotal = Number(item.quantity) * Number(item.price);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0"
              >
                <div className="flex-1">
                  <span className="text-slate-800">
                    {item.product.name} × {Number(item.quantity)}
                  </span>
                  {canEditItems && (
                    <div className="mt-1 flex gap-2 text-xs">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const newQtyStr = prompt(
                            `New quantity for ${item.product.name} (current ${Number(
                              item.quantity,
                            )})`,
                            String(Number(item.quantity) - 1),
                          );
                          if (!newQtyStr) return;
                          const newQty = Number(newQtyStr);
                          if (!newQty || newQty <= 0 || newQty >= Number(item.quantity)) {
                            alert('Only reducing quantity is allowed');
                            return;
                          }
                          try {
                            await api.patch(`/orders/${order.id}/items/${item.id}`, {
                              quantity: newQty,
                            });
                            fetchOrder();
                          } catch (e) {
                            alert(
                              (e as { response?: { data?: { message?: string } } })?.response
                                ?.data?.message ?? 'Failed to update item',
                            );
                          }
                        }}
                      >
                        Edit qty
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Remove ${item.product.name} from this order? This will reduce the total amount.`,
                            )
                          )
                            return;
                          try {
                            await api.patch(`/orders/${order.id}/items/${item.id}`, {
                              remove: true,
                            });
                            fetchOrder();
                          } catch (e) {
                            alert(
                              (e as { response?: { data?: { message?: string } } })?.response
                                ?.data?.message ?? 'Failed to remove item',
                            );
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
                <span className="text-accent font-medium">
                  Rs {lineTotal.toFixed(0)}
                </span>
              </div>
            );
          })}
          {order.subtotalAmount != null && (
            <div className="flex justify-between py-1 text-slate-600 text-sm">
              <span>Subtotal</span>
              <span>Rs {Number(order.subtotalAmount).toFixed(0)}</span>
            </div>
          )}
          {order.deliveryFee != null && Number(order.deliveryFee) > 0 && (
            <div className="flex justify-between py-1 text-slate-600 text-sm">
              <span>Delivery</span>
              <span>Rs {Number(order.deliveryFee).toFixed(0)}</span>
            </div>
          )}
          {order.serviceFee != null && Number(order.serviceFee) > 0 && (
            <div className="flex justify-between py-1 text-slate-600 text-sm">
              <span>Service fee</span>
              <span>Rs {Number(order.serviceFee).toFixed(2)}</span>
            </div>
          )}
          {order.gstAmount != null && Number(order.gstAmount) > 0 && (
            <div className="flex justify-between py-1 text-slate-600 text-sm">
              <span>GST (COD)</span>
              <span>Rs {Number(order.gstAmount).toFixed(2)}</span>
            </div>
          )}
          {order.cardProcessingAmount != null && Number(order.cardProcessingAmount) > 0 && (
            <div className="flex justify-between py-1 text-slate-600 text-sm">
              <span>Card processing</span>
              <span>Rs {Number(order.cardProcessingAmount).toFixed(2)}</span>
            </div>
          )}
          {order.paymentMethod && (
            <p className="text-xs text-slate-500 pt-1">Payment: {order.paymentMethod}</p>
          )}
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
