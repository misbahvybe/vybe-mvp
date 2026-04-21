'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { GalleryImageInput } from '@/components/ui/GalleryImageInput';
import Link from 'next/link';
import {
  Package,
  Check,
  X,
  MapPin,
  Banknote,
  CreditCard,
} from 'lucide-react';
import api from '@/services/api';
import { useOrdersRealtime } from '@/hooks/useOrdersRealtime';
import { useLoopingOrderAlarm } from '@/hooks/useLoopingOrderAlarm';
import { printOrderSlip, type OrderSlipInput } from '@/lib/printOrderSlip';
import { StoreOwnerNavTabs } from '@/components/store/StoreOwnerNavTabs';
import { enableWebPushForCurrentUser, getWebPushUiStatus, type WebPushUiStatus } from '@/services/push';

const StoreLocationMapPicker = dynamic(
  () => import('@/components/map/StoreLocationMapPicker').then((m) => m.StoreLocationMapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] flex items-center justify-center bg-slate-100 rounded-card border border-slate-200">
        <Loader size={40} />
      </div>
    ),
  },
);

const POLL_INTERVAL_MS = 120000;

function timeAgo(d: string) {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} mins ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

interface Order {
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
}

function orderToSlip(storeName: string, o: Order): OrderSlipInput {
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

type Tab = 'orders' | 'products' | 'earnings' | 'settings';

export default function StoreDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader size={44} />
        </div>
      }
    >
      <StoreDashboardInner />
    </Suspense>
  );
}

function StoreDashboardInner() {
  const token = useAuthStore((s) => s.token);
  const sp = useSearchParams();
  const tab = ((): Tab => {
    const v = sp?.get('tab');
    return v === 'products' || v === 'earnings' || v === 'settings' ? v : 'orders';
  })();
  const [orders, setOrders] = useState<Order[]>([]);
  const [store, setStore] = useState<{
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    phone?: string;
    address?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    isOpen: boolean;
    acceptingOrders?: boolean;
    openingTime?: string;
    closingTime?: string;
  } | null>(null);
  const [earnings, setEarnings] = useState<{
    today: { orders: number; revenue: number; commission: number; net: number };
    balance: {
      storeId: string | null;
      totalEarned: number;
      totalPaidOut: number;
      reserved: number;
      available: number;
    };
    history: {
      kind?: string;
      orderId: string;
      createdAt: string;
      storeAmount: number;
      commissionAmount: number;
    }[];
    payoutHistory: {
      id: string;
      withdrawRequestId: string;
      createdAt: string;
      amount: number;
    }[];
  } | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; sortOrder: number; products: unknown[] }[]>([]);
  const [products, setProducts] = useState<
    {
      id: string;
      name: string;
      description?: string | null;
      price: number;
      stock: number;
      isAvailable: boolean;
      isOutOfStock: boolean;
      productCategoryId?: string | null;
      category?: { name: string };
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pushUi, setPushUi] = useState<WebPushUiStatus | null>(null);

  const fetchOrders = useCallback(() => {
    api.get<Order[]>('/orders').then((r) => setOrders(r.data ?? [])).catch(() => setOrders([]));
  }, []);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Order[]>('/orders').then((r) => r.data ?? []),
      api.get('/store-owner/store').then((r) => r.data),
      api.get('/store-owner/earnings').then((r) => r.data),
      api.get('/store-owner/categories').then((r) => r.data),
      api.get('/store-owner/products').then((r) => r.data),
    ])
      .then(([ords, st, earn, cats, prods]) => {
        setOrders(ords);
        setStore(st);
        setEarnings(earn);
        setCategories(cats ?? []);
        setProducts(prods ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    void getWebPushUiStatus(Boolean(token)).then(setPushUi);
  }, [token]);

  useEffect(() => {
    if (tab !== 'orders') return;
    const id = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tab, fetchOrders]);

  useOrdersRealtime(
    tab === 'orders' && !!token,
    token,
    'STORE_OWNER',
    store?.id ?? null,
    fetchOrders,
  );

  // Fallback polling: if socket delivery is missed, keep orders fresh.
  useEffect(() => {
    if (tab !== 'orders') return;
    const id = setInterval(fetchOrders, 10000);
    return () => clearInterval(id);
  }, [tab, fetchOrders]);

  const pending = orders.filter((o) => o.orderStatus === 'PENDING');
  const preparing = orders.filter((o) => o.orderStatus === 'STORE_ACCEPTED');
  const readyForPickup = orders.filter((o) => o.orderStatus === 'READY_FOR_PICKUP');
  const delivered = orders.filter((o) => o.orderStatus === 'DELIVERED');

  const shouldRingNewOrders =
    tab === 'orders' && Boolean(token) && pending.length > 0 && !actionLoading;
  const { stopAlarm } = useLoopingOrderAlarm(shouldRingNewOrders);

  const updateOrderStatus = async (orderId: string, status: string) => {
    stopAlarm();
    setActionLoading(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      if (status === 'STORE_ACCEPTED' && store) {
        const slipOrder = orders.find((x) => x.id === orderId);
        if (slipOrder) printOrderSlip(orderToSlip(store.name, slipOrder));
      }
      fetchOrders();
      fetchAll();
    } catch {
      alert('Failed to update order');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Store Dashboard" wideShell />
      <ContentPanel>
        <div className="app-shell-wide pt-3">
          <Card className="p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">POS / Kitchen Screen</p>
              <p className="text-xs text-slate-500">Use on a tablet for live order alerts + big buttons.</p>
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
              <Link href="/store/pos">
                <Button size="sm" variant="primary">Open POS</Button>
              </Link>
            </div>
          </Card>
        </div>
        <div className="sticky top-0 z-10">
          <StoreOwnerNavTabs wide />
        </div>
        <main className="app-shell-wide py-4">
          {tab === 'orders' && (
            <>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New Orders</h2>
              {pending.length === 0 ? (
                <Card className="py-6 text-center mb-6">
                  <p className="text-slate-500">No new orders</p>
                </Card>
              ) : (
                <div className="space-y-3 mb-6">
                  {pending.map((o) => (
                    <Card key={o.id} className="p-4 border-2 border-amber-200">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-slate-800">#{o.orderNumber ?? o.id.slice(-8).toUpperCase()}</p>
                        <span className="text-xs text-slate-500">{timeAgo(o.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {o.items.length} items · {Number(o.totalAmount).toLocaleString()} PKR
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {o.paymentMethod === 'COD' ? (
                          <span className="inline-flex items-center gap-1"><Banknote className="w-3 h-3" /> COD</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600"><CreditCard className="w-3 h-3" /> Paid</span>
                        )}
                      </p>
                      {o.address?.fullAddress && (
                        <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{o.address.fullAddress}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => store && printOrderSlip(orderToSlip(store.name, o))}
                          className="flex-1 min-w-[120px]"
                        >
                          Print slip
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={actionLoading === o.id}
                          onClick={() => updateOrderStatus(o.id, 'STORE_ACCEPTED')}
                          className="flex-1 min-w-[120px]"
                        >
                          <Check className="w-4 h-4 mr-1 inline" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!actionLoading}
                          onClick={() => updateOrderStatus(o.id, 'STORE_REJECTED')}
                          className="flex-1 min-w-[120px]"
                        >
                          <X className="w-4 h-4 mr-1 inline" />
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Preparing</h2>
              {preparing.length === 0 ? (
                <Card className="py-4 text-center mb-6">
                  <p className="text-slate-500 text-sm">None</p>
                </Card>
              ) : (
                <div className="space-y-3 mb-6">
                  {preparing.map((o) => (
                    <Card key={o.id} className="p-4 border-l-4 border-amber-400">
                      <p className="font-bold text-slate-800">#{o.orderNumber ?? o.id.slice(-8).toUpperCase()}</p>
                      <ul className="text-sm text-slate-600 mt-1 space-y-0.5">
                        {o.items.map((i, idx) => (
                          <li key={idx}>{i.product.name} × {Number(i.quantity)}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-slate-500 mt-1">{timeAgo(o.createdAt)}</p>
                      <Button
                        size="sm"
                        className="mt-3"
                        loading={actionLoading === o.id}
                        onClick={() => updateOrderStatus(o.id, 'READY_FOR_PICKUP')}
                      >
                        <Package className="w-4 h-4 mr-1 inline" />
                        Mark Ready for Pickup
                      </Button>
                    </Card>
                  ))}
                </div>
              )}

              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Ready for Pickup</h2>
              {readyForPickup.length === 0 ? (
                <Card className="py-4 text-center mb-6">
                  <p className="text-slate-500 text-sm">None</p>
                </Card>
              ) : (
                <div className="space-y-2 mb-6">
                  {readyForPickup.map((o) => (
                    <Card key={o.id} className="p-4 border-l-4 border-green-400">
                      <p className="font-bold text-slate-800">#{o.orderNumber ?? o.id.slice(-8).toUpperCase()}</p>
                      <p className="text-sm text-slate-500">Waiting for captain</p>
                    </Card>
                  ))}
                </div>
              )}

              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Completed</h2>
              {delivered.length === 0 ? (
                <Card className="py-4 text-center">
                  <p className="text-slate-500 text-sm">No completed orders yet</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {delivered.slice(0, 10).map((o) => (
                    <Card key={o.id} className="p-3 flex justify-between items-center opacity-80">
                      <span className="font-medium">#{o.orderNumber ?? o.id.slice(-8).toUpperCase()}</span>
                      <span className="text-accent font-semibold">{Number(o.totalAmount).toLocaleString()} PKR</span>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'products' && (
            <StoreProductsTab categories={categories} products={products} loading={loading} onRefresh={fetchAll} />
          )}

          {tab === 'earnings' && (
            <>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader size={44} />
                </div>
              ) : earnings ? (
                <>
                  <Card className="p-4 mb-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Available to withdraw</p>
                      <p className="text-2xl font-bold text-accent">
                        {(earnings.balance?.available ?? earnings.today.net).toLocaleString()} PKR
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Earned {earnings.balance?.totalEarned?.toLocaleString() ?? '—'} PKR · Paid out{' '}
                        {earnings.balance?.totalPaidOut?.toLocaleString() ?? '—'} PKR · Pending{' '}
                        {earnings.balance?.reserved?.toLocaleString() ?? '—'} PKR
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const amountStr = prompt(
                          'Withdraw amount (PKR)',
                          String(earnings.balance?.available ?? earnings.today.net),
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
                            const { data } = await api.get('/store-owner/earnings');
                            setEarnings(data);
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
                  <Card className="p-4 mb-6">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Today</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Orders</p>
                        <p className="text-xl font-bold text-slate-800">{earnings.today.orders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Revenue</p>
                        <p className="text-xl font-bold text-slate-800">{earnings.today.revenue.toLocaleString()} PKR</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Commission</p>
                        <p className="text-xl font-bold text-slate-600">-{earnings.today.commission.toLocaleString()} PKR</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Net Earnings</p>
                        <p className="text-xl font-bold text-accent">{earnings.today.net.toLocaleString()} PKR</p>
                      </div>
                    </div>
                  </Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Delivered orders</h3>
                  <div className="space-y-2">
                    {earnings.history.map((e) => (
                      <Card key={e.orderId} className="p-3 flex justify-between">
                        <div>
                          <p className="font-medium">#{e.orderId.slice(-8).toUpperCase()}</p>
                          <p className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleDateString()}</p>
                        </div>
                        <p className="font-semibold text-accent">{e.storeAmount.toLocaleString()} PKR</p>
                      </Card>
                    ))}
                    {earnings.history.length === 0 && (
                      <Card className="py-8 text-center">
                        <p className="text-slate-500">No earnings yet</p>
                      </Card>
                    )}
                  </div>
                  {earnings.payoutHistory && earnings.payoutHistory.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-6">Withdrawals paid</h3>
                      <div className="space-y-2">
                        {earnings.payoutHistory.map((p) => (
                          <Card
                            key={p.id}
                            className="p-3 flex justify-between items-center border-l-4 border-emerald-500"
                          >
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
                <Card className="py-8 text-center">
                  <p className="text-slate-500">Loading...</p>
                </Card>
              )}
            </>
          )}

          {tab === 'settings' && (
            <StoreSettingsTab store={store} loading={loading} onRefresh={fetchAll} />
          )}
        </main>
      </ContentPanel>
    </div>
  );
}

function StoreProductsTab({
  categories,
  products,
  loading,
  onRefresh,
}: {
  categories: { id: string; name: string; products: unknown[] }[];
  products: {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    stock: number;
    isAvailable: boolean;
    isOutOfStock: boolean;
    imageUrl?: string | null;
    productCategoryId?: string | null;
    category?: { name: string };
  }[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock: '999',
    productCategoryId: '',
    imageUrl: '',
    isAvailable: true,
  });
  const [editProduct, setEditProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock: 0,
    productCategoryId: '',
    imageUrl: '',
    isAvailable: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/store-owner/categories', { name: newCategoryName.trim() });
      setNewCategoryName('');
      setShowAddCategory(false);
      onRefresh();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const addProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) return;
    setSubmitting(true);
    try {
      await api.post('/store-owner/products', {
        name: newProduct.name.trim(),
        description: newProduct.description.trim() || undefined,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock) || 999,
        productCategoryId: newProduct.productCategoryId || undefined,
        imageUrl: newProduct.imageUrl.trim() || undefined,
        isAvailable: newProduct.isAvailable,
      });
      setNewProduct({
        name: '',
        description: '',
        price: '',
        stock: '999',
        productCategoryId: '',
        imageUrl: '',
        isAvailable: true,
      });
      setShowAddProduct(false);
      onRefresh();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOutOfStock = async (productId: string, current: boolean) => {
    try {
      await api.patch(`/store-owner/products/${productId}/out-of-stock`, { isOutOfStock: !current });
      onRefresh();
    } catch {
      alert('Failed');
    }
  };

  const startEdit = (p: {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    stock: number;
    productCategoryId?: string | null;
    imageUrl?: string | null;
    isAvailable?: boolean;
  }) => {
    setEditingProductId(p.id);
    setEditProduct({
      name: p.name,
      description: p.description ?? '',
      price: String(p.price),
      stock: Number(p.stock),
      productCategoryId: p.productCategoryId ?? '',
      imageUrl: p.imageUrl ?? '',
      isAvailable: p.isAvailable ?? true,
    });
  };

  const saveProduct = async () => {
    if (!editingProductId) return;
    setSubmitting(true);
    try {
      await api.patch(`/store-owner/products/${editingProductId}`, {
        name: editProduct.name.trim(),
        description: editProduct.description.trim() || undefined,
        price: Number(editProduct.price),
        stock: Number(editProduct.stock),
        productCategoryId: editProduct.productCategoryId || undefined,
        imageUrl: editProduct.imageUrl.trim() || undefined,
        isAvailable: editProduct.isAvailable,
      });
      setEditingProductId(null);
      onRefresh();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size={44} />
      </div>
    );
  }

  const uncategorized = products.filter((p) => !p.productCategoryId);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowAddCategory(true)}>
          Add Category
        </Button>
        <Button size="sm" variant="primary" onClick={() => setShowAddProduct(true)}>
          Add Product
        </Button>
      </div>
      {showAddCategory && (
        <Card className="p-4">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name"
            className="w-full px-3 py-2 border rounded-button mb-3"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addCategory} loading={submitting} disabled={!newCategoryName.trim()}>
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddCategory(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
      {editingProductId && (
        <Card className="p-4 border-2 border-primary">
          <p className="font-semibold mb-3">Edit product</p>
          <input
            value={editProduct.name}
            onChange={(e) => setEditProduct((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name"
            className="w-full px-3 py-2 border rounded-button mb-2"
          />
          <textarea
            value={editProduct.description}
            onChange={(e) => setEditProduct((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description (e.g. deal contents)"
            className="w-full px-3 py-2 border rounded-button mb-2 min-h-[80px] resize-y text-sm"
          />
          <div className="mb-2">
            <span className="block text-xs font-medium text-slate-600 mb-1">Product image</span>
            <GalleryImageInput
              idPrefix={`store-edit-${editingProductId ?? 'p'}`}
              value={editProduct.imageUrl}
              onChange={(url) => setEditProduct((f) => ({ ...f, imageUrl: url }))}
            />
          </div>
          <input
            type="number"
            value={editProduct.price}
            onChange={(e) => setEditProduct((f) => ({ ...f, price: e.target.value }))}
            placeholder="Price"
            className="w-full px-3 py-2 border rounded-button mb-2"
          />
          <input
            type="number"
            value={editProduct.stock}
            onChange={(e) => setEditProduct((f) => ({ ...f, stock: Number(e.target.value) }))}
            placeholder="Stock"
            className="w-full px-3 py-2 border rounded-button mb-2"
          />
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="edit-available"
              checked={editProduct.isAvailable}
              onChange={(e) => setEditProduct((f) => ({ ...f, isAvailable: e.target.checked }))}
              className="rounded border-slate-300"
            />
            <label htmlFor="edit-available" className="text-sm text-slate-700">Available (show to customers)</label>
          </div>
          <select
            value={editProduct.productCategoryId}
            onChange={(e) => setEditProduct((f) => ({ ...f, productCategoryId: e.target.value }))}
            className="w-full px-3 py-2 border rounded-button mb-3"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveProduct} loading={submitting}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setEditingProductId(null)}>Cancel</Button>
          </div>
        </Card>
      )}
      {showAddProduct && (
        <Card className="p-4">
          <input
            value={newProduct.name}
            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            placeholder="Product name"
            className="w-full px-3 py-2 border rounded-button mb-2"
          />
          <textarea
            value={newProduct.description}
            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
            placeholder="Description (e.g. deal: 1 Burger + Fries + Drink)"
            className="w-full px-3 py-2 border rounded-button mb-2 min-h-[80px] resize-y text-sm"
          />
          <div className="mb-2">
            <span className="block text-xs font-medium text-slate-600 mb-1">Product image</span>
            <GalleryImageInput
              idPrefix="store-new-product"
              value={newProduct.imageUrl}
              onChange={(url) => setNewProduct({ ...newProduct, imageUrl: url })}
            />
          </div>
          <input
            type="number"
            value={newProduct.price}
            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
            placeholder="Price (PKR)"
            className="w-full px-3 py-2 border rounded-button mb-2"
          />
          <input
            type="number"
            value={newProduct.stock}
            onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
            placeholder="Stock"
            className="w-full px-3 py-2 border rounded-button mb-2"
          />
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="new-available"
              checked={newProduct.isAvailable}
              onChange={(e) => setNewProduct({ ...newProduct, isAvailable: e.target.checked })}
              className="rounded border-slate-300"
            />
            <label htmlFor="new-available" className="text-sm text-slate-700">Available (show to customers)</label>
          </div>
          <select
            value={newProduct.productCategoryId}
            onChange={(e) => setNewProduct({ ...newProduct, productCategoryId: e.target.value })}
            className="w-full px-3 py-2 border rounded-button mb-3"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" onClick={addProduct} loading={submitting} disabled={!newProduct.name.trim() || !newProduct.price}>
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddProduct(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
      <div className="space-y-4">
        {categories.map((cat) => {
          const prods = products.filter((p) => p.productCategoryId === cat.id);
          if (prods.length === 0) return null;
          return (
            <div key={cat.id}>
              <h3 className="font-semibold text-slate-800 mb-2">{cat.name}</h3>
              <div className="space-y-2">
                {prods.map((p) => (
                  <Card key={p.id} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.description ? (
                        <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap line-clamp-2">{p.description}</p>
                      ) : null}
                      <p className="text-sm text-slate-600">Rs {p.price} · Stock: {Number(p.stock)} {p.isOutOfStock && '(Out)'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleOutOfStock(p.id, p.isOutOfStock)}
                        className={`text-xs px-2 py-1 rounded ${p.isOutOfStock ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}
                      >
                        {p.isOutOfStock ? 'In stock' : 'Out'}
                      </button>
                      <button type="button" onClick={() => startEdit(p)} className="text-xs text-primary">Edit</button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
        {uncategorized.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Uncategorized</h3>
            <div className="space-y-2">
              {uncategorized.map((p) => (
                <Card key={p.id} className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.description ? (
                      <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap line-clamp-2">{p.description}</p>
                    ) : null}
                    <p className="text-sm text-slate-600">Rs {p.price} · Stock: {Number(p.stock)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleOutOfStock(p.id, p.isOutOfStock)}
                      className="text-xs px-2 py-1 rounded bg-slate-100"
                    >
                      {p.isOutOfStock ? 'In stock' : 'Out'}
                    </button>
                    <button type="button" onClick={() => startEdit(p)} className="text-xs text-primary">Edit</button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StoreSettingsTab({
  store,
  loading,
  onRefresh,
}: {
  store: {
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    phone?: string;
    address?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    isOpen: boolean;
    acceptingOrders?: boolean;
    openingTime?: string;
    closingTime?: string;
  } | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    phone: '',
    address: '',
    city: 'Lahore',
    latitude: '',
    longitude: '',
    openingTime: '09:00',
    closingTime: '22:00',
    isOpen: true,
    acceptingOrders: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setForm({
        name: store.name,
        description: store.description ?? '',
        imageUrl: store.imageUrl ?? '',
        phone: store.phone ?? '',
        address: store.address ?? '',
        city: store.city ?? 'Lahore',
        latitude: store.latitude != null ? String(store.latitude) : '',
        longitude: store.longitude != null ? String(store.longitude) : '',
        openingTime: store.openingTime ?? '09:00',
        closingTime: store.closingTime ?? '22:00',
        isOpen: store.isOpen,
        acceptingOrders: store.acceptingOrders !== false,
      });
    }
  }, [store]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/store-owner/store', {
        ...form,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      onRefresh();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size={44} />
      </div>
    );
  }

  if (!store) {
    return (
      <Card className="p-6 text-center text-sm text-slate-500">
        Store could not be loaded. Go back to the Orders tab or refresh the page.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">Store Open</span>
        <button
          type="button"
          role="switch"
          aria-checked={form.isOpen}
          onClick={() => setForm((f) => ({ ...f, isOpen: !f.isOpen }))}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${form.isOpen ? 'bg-green-500' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${form.isOpen ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>
      <p className={`text-sm ${form.isOpen ? 'text-green-600' : 'text-red-600'}`}>
        {form.isOpen ? 'Open – customers can order' : 'Closed – store hidden from listing'}
      </p>
      <div className="flex items-center justify-between">
        <span className="font-medium">Accept new orders</span>
        <button
          type="button"
          role="switch"
          aria-checked={form.acceptingOrders}
          onClick={() => setForm((f) => ({ ...f, acceptingOrders: !f.acceptingOrders }))}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${form.acceptingOrders ? 'bg-green-500' : 'bg-slate-300'}`}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${form.acceptingOrders ? 'translate-x-7' : 'translate-x-1'}`}
          />
        </button>
      </div>
      <p className={`text-sm ${form.acceptingOrders ? 'text-slate-600' : 'text-amber-700'}`}>
        {form.acceptingOrders
          ? 'New orders can arrive (you can turn this off when the kitchen is overloaded).'
          : 'Paused – customers will not be able to place new orders until you turn this back on.'}
      </p>
      <Card className="p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Store Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Karachi Biryani House"
            className="w-full px-3 py-2 border rounded-button"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Store photo (listing)</label>
          <GalleryImageInput
            idPrefix="store-settings-banner"
            value={form.imageUrl}
            onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="e.g. Authentic biryani & karahi"
            className="w-full px-3 py-2 border rounded-button"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2 border rounded-button"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Address / Location</label>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="e.g. DHA Phase 5, Lahore"
            className="w-full px-3 py-2 border rounded-button"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Lahore"
            className="w-full px-3 py-2 border rounded-button"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            Pin on map (orange dots = other food restaurants on Vybe)
          </label>
          <div className="mt-1">
            <StoreLocationMapPicker
              key={`${store.id}-${store.latitude ?? 'x'}-${store.longitude ?? 'x'}`}
              storeId={store.id}
              initialLat={store.latitude != null ? Number(store.latitude) : undefined}
              initialLng={store.longitude != null ? Number(store.longitude) : undefined}
              onSelect={(line, city, lat, lng) => {
                setForm((f) => ({
                  ...f,
                  address: line || f.address,
                  city: city || f.city,
                  latitude: String(lat),
                  longitude: String(lng),
                }));
              }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Coordinates are set from the purple pin. You can edit latitude / longitude below if needed.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
            <input
              type="text"
              value={form.latitude}
              onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              placeholder="31.5204"
              className="w-full px-3 py-2 border rounded-button"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
            <input
              type="text"
              value={form.longitude}
              onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              placeholder="74.3587"
              className="w-full px-3 py-2 border rounded-button"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opening</label>
            <input
              type="time"
              value={form.openingTime}
              onChange={(e) => setForm((f) => ({ ...f, openingTime: e.target.value }))}
              className="w-full px-3 py-2 border rounded-button"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Closing</label>
            <input
              type="time"
              value={form.closingTime}
              onChange={(e) => setForm((f) => ({ ...f, closingTime: e.target.value }))}
              className="w-full px-3 py-2 border rounded-button"
            />
          </div>
        </div>
        <Button onClick={save} loading={saving} fullWidth>
          Save changes
        </Button>
      </Card>
    </div>
  );
}
