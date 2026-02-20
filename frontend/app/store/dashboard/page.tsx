'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Package,
  ShoppingBag,
  Wallet,
  Settings,
  Check,
  X,
  MapPin,
  Banknote,
  CreditCard,
} from 'lucide-react';
import api from '@/services/api';

const POLL_INTERVAL_MS = 15000;

function timeAgo(d: string) {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} mins ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

interface Order {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod?: string;
  paymentStatus?: string;
  customer?: { name: string; phone: string };
  address?: { fullAddress: string };
  items: { product: { name: string }; quantity: number; price: number }[];
}

type Tab = 'orders' | 'products' | 'earnings' | 'settings';

export default function StoreDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [store, setStore] = useState<{
    id: string;
    name: string;
    phone?: string;
    address?: string;
    isOpen: boolean;
    openingTime?: string;
    closingTime?: string;
  } | null>(null);
  const [earnings, setEarnings] = useState<{
    today: { orders: number; revenue: number; commission: number; net: number };
    history: { orderId: string; createdAt: string; storeAmount: number; commissionAmount: number }[];
  } | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; sortOrder: number; products: unknown[] }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; price: number; stock: number; isAvailable: boolean; isOutOfStock: boolean; productCategoryId?: string | null; category?: { name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    if (tab !== 'orders') return;
    const id = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tab, fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    setActionLoading(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      fetchOrders();
      fetchAll();
    } catch {
      alert('Failed to update order');
    } finally {
      setActionLoading(null);
    }
  };

  const pending = orders.filter((o) => o.orderStatus === 'PENDING');
  const preparing = orders.filter((o) => o.orderStatus === 'STORE_ACCEPTED');
  const readyForPickup = orders.filter((o) => o.orderStatus === 'READY_FOR_PICKUP');
  const delivered = orders.filter((o) => o.orderStatus === 'DELIVERED');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'orders', label: 'Orders', icon: <Package className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'earnings', label: 'Earnings', icon: <Wallet className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Store Dashboard" />
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ContentPanel>
        <main className="max-w-lg mx-auto px-4 py-4">
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
                        <p className="font-bold text-slate-800">#{o.id.slice(-8).toUpperCase()}</p>
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
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="primary"
                          loading={actionLoading === o.id}
                          onClick={() => updateOrderStatus(o.id, 'STORE_ACCEPTED')}
                          className="flex-1"
                        >
                          <Check className="w-4 h-4 mr-1 inline" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!actionLoading}
                          onClick={() => updateOrderStatus(o.id, 'STORE_REJECTED')}
                          className="flex-1"
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
                      <p className="font-bold text-slate-800">#{o.id.slice(-8).toUpperCase()}</p>
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
                      <p className="font-bold text-slate-800">#{o.id.slice(-8).toUpperCase()}</p>
                      <p className="text-sm text-slate-500">Waiting for rider</p>
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
                      <span className="font-medium">#{o.id.slice(-8).toUpperCase()}</span>
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
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : earnings ? (
                <>
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
  products: { id: string; name: string; price: number; stock: number; isAvailable: boolean; isOutOfStock: boolean; productCategoryId?: string | null; category?: { name: string } }[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '999', productCategoryId: '' });
  const [editProduct, setEditProduct] = useState({ name: '', price: '', stock: 0, productCategoryId: '' });
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
        price: Number(newProduct.price),
        stock: Number(newProduct.stock) || 999,
        productCategoryId: newProduct.productCategoryId || undefined,
      });
      setNewProduct({ name: '', price: '', stock: '999', productCategoryId: '' });
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

  const startEdit = (p: { id: string; name: string; price: number; stock: number; productCategoryId?: string | null }) => {
    setEditingProductId(p.id);
    setEditProduct({
      name: p.name,
      price: String(p.price),
      stock: Number(p.stock),
      productCategoryId: p.productCategoryId ?? '',
    });
  };

  const saveProduct = async () => {
    if (!editingProductId) return;
    setSubmitting(true);
    try {
      await api.patch(`/store-owner/products/${editingProductId}`, {
        name: editProduct.name.trim(),
        price: Number(editProduct.price),
        stock: Number(editProduct.stock),
        productCategoryId: editProduct.productCategoryId || undefined,
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
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
            className="w-full px-3 py-2 border rounded-button mb-3"
          />
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
  store: { id: string; name: string; phone?: string; address?: string; isOpen: boolean; openingTime?: string; closingTime?: string } | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    openingTime: '09:00',
    closingTime: '22:00',
    isOpen: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setForm({
        name: store.name,
        phone: store.phone ?? '',
        address: store.address ?? '',
        openingTime: store.openingTime ?? '09:00',
        closingTime: store.closingTime ?? '22:00',
        isOpen: store.isOpen,
      });
    }
  }, [store]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/store-owner/store', form);
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
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
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
      <Card className="p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Store Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full px-3 py-2 border rounded-button"
          />
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
