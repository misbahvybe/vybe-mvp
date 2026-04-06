'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { GalleryImageInput } from '@/components/ui/GalleryImageInput';
import api from '@/services/api';
import { ArrowLeft, LayoutGrid, UtensilsCrossed } from 'lucide-react';

const PLATFORM_VERTICALS = [
  { slug: 'food', label: 'Food' },
  { slug: 'grocery', label: 'Grocery' },
  { slug: 'medicine', label: 'Medicine' },
] as const;

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  products: { id: string; name: string }[];
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  isAvailable: boolean;
  isOutOfStock: boolean;
  productCategoryId?: string | null;
  imageUrl?: string | null;
  category?: { id: string; name: string } | null;
  variants?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[];
}

export default function AdminStoreMenuPage() {
  const params = useParams();
  const storeId = params?.storeId as string;
  const [storeName, setStoreName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '999',
    productCategoryId: '',
    imageUrl: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [platformCategorySlugs, setPlatformCategorySlugs] = useState<string[]>([]);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [newVariant, setNewVariant] = useState({ name: '', price: '', sortOrder: '0' });
  const [editForm, setEditForm] = useState({
    name: '',
    price: '',
    stock: '',
    productCategoryId: '',
    imageUrl: '',
    isAvailable: true,
  });

  const fetchAll = useCallback(() => {
    if (!storeId) return;
    setLoading(true);
    setErr(null);
    Promise.all([
      api.get<Category[]>(`/admin/stores/${storeId}/categories`).then((r) => r.data ?? []),
      api.get<Product[]>(`/admin/stores/${storeId}/products`).then((r) => r.data ?? []),
      api
        .get<{ names: string[] }>(`/admin/platform-store-categories/${storeId}`)
        .then((r) => r.data?.names ?? [])
        .catch(() => [] as string[]),
      api.get<{ id: string; name: string }[]>('/admin/stores').then((r) => {
        const s = (r.data ?? []).find((x) => x.id === storeId);
        return s?.name ?? '';
      }),
    ])
      .then(([cats, prods, platformNames, name]) => {
        setCategories(cats);
        setProducts(prods);
        setPlatformCategorySlugs(platformNames);
        setStoreName(name);
      })
      .catch((e) => {
        setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load menu');
        setCategories([]);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addCategory = async () => {
    if (!storeId || !newCategoryName.trim()) return;
    try {
      await api.post(`/admin/stores/${storeId}/categories`, { name: newCategoryName.trim() });
      setNewCategoryName('');
      fetchAll();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add category');
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!storeId || !confirm('Delete this category? Products in it become uncategorized.')) return;
    try {
      await api.delete(`/admin/stores/${storeId}/categories/${categoryId}`);
      fetchAll();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete category');
    }
  };

  const togglePlatformSlug = (slug: string) => {
    setPlatformCategorySlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const savePlatformCategories = async () => {
    if (!storeId) return;
    setPlatformSaving(true);
    try {
      await api.post(`/admin/platform-store-categories/${storeId}`, { names: platformCategorySlugs });
    } catch (e) {
      alert(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to save platform categories',
      );
    } finally {
      setPlatformSaving(false);
    }
  };

  const addProduct = async () => {
    if (!storeId || !newProduct.name.trim() || !newProduct.price) return;
    try {
      await api.post(`/admin/stores/${storeId}/products`, {
        name: newProduct.name.trim(),
        price: Number(newProduct.price),
        stock: Number(newProduct.stock) || 999,
        productCategoryId: newProduct.productCategoryId || undefined,
        imageUrl: newProduct.imageUrl.trim() || undefined,
        isAvailable: true,
      });
      setNewProduct({ name: '', price: '', stock: '999', productCategoryId: '', imageUrl: '' });
      fetchAll();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add product');
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      productCategoryId: p.productCategoryId ?? '',
      imageUrl: p.imageUrl ?? '',
      isAvailable: p.isAvailable ?? true,
    });
  };

  const saveProduct = async () => {
    if (!storeId || !editingId) return;
    try {
      await api.patch(`/admin/stores/${storeId}/products/${editingId}`, {
        name: editForm.name.trim(),
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        productCategoryId: editForm.productCategoryId || undefined,
        imageUrl: editForm.imageUrl.trim() || undefined,
        isAvailable: editForm.isAvailable,
      });
      setEditingId(null);
      fetchAll();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save product');
    }
  };

  const addVariant = async () => {
    if (!storeId || !editingId) return;
    const name = newVariant.name.trim();
    const price = Number(newVariant.price);
    const sortOrder = Number(newVariant.sortOrder) || 0;
    if (!name || Number.isNaN(price) || price < 0) return;
    try {
      await api.post(`/admin/stores/${storeId}/products/${editingId}/variants`, {
        name,
        price,
        sortOrder,
        isAvailable: true,
      });
      setNewVariant({ name: '', price: '', sortOrder: '0' });
      fetchAll();
    } catch (e) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(' ') : raw;
      alert(msg ?? 'Failed to add variant');
    }
  };

  const patchVariant = async (
    variantId: string,
    patch: Partial<{ name: string; price: number; isAvailable: boolean; sortOrder: number }>,
  ) => {
    if (!storeId || !editingId) return;
    try {
      await api.patch(`/admin/stores/${storeId}/products/${editingId}/variants/${variantId}`, patch);
      fetchAll();
    } catch (e) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(' ') : raw;
      alert(msg ?? 'Failed to update variant');
    }
  };

  const deleteVariant = async (variantId: string) => {
    if (!storeId || !editingId || !confirm('Delete this variant?')) return;
    try {
      await api.delete(`/admin/stores/${storeId}/products/${editingId}/variants/${variantId}`);
      fetchAll();
    } catch (e) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(' ') : raw;
      alert(msg ?? 'Failed to delete variant');
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!storeId || !confirm('Delete this product permanently?')) return;
    try {
      await api.delete(`/admin/stores/${storeId}/products/${productId}`);
      fetchAll();
    } catch (e) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(' ') : raw;
      alert(msg ?? 'Failed to delete product');
    }
  };

  const toggleOos = async (p: Product) => {
    if (!storeId) return;
    try {
      await api.patch(`/admin/stores/${storeId}/products/${p.id}/out-of-stock`, {
        isOutOfStock: !p.isOutOfStock,
      });
      fetchAll();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update stock flag');
    }
  };

  if (!storeId) {
    return <p className="text-slate-600">Invalid store.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link href="/admin/stores" className="text-primary text-sm font-medium inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Stores
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
        <UtensilsCrossed className="w-7 h-7 text-primary" />
        Store menu
      </h1>
      <p className="text-slate-600 text-sm mb-6">
        Manage menu categories, platform placement (Food / Grocery / Medicine), and products for{' '}
        <span className="font-semibold text-slate-800">{storeName || '…'}</span>
      </p>

      {err && (
        <Card className="p-4 mb-4 border-red-200 bg-red-50">
          <p className="text-red-800 text-sm">{err}</p>
        </Card>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading menu…</div>
      ) : (
        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              Platform categories
            </h2>
            <p className="text-slate-600 text-sm mb-3">
              Choose where this store appears in the customer app. At least one is required for the store to show under
              Food, Grocery, or Medicine.
            </p>
            <div className="flex flex-wrap gap-4 mb-3">
              {PLATFORM_VERTICALS.map(({ slug, label }) => (
                <label key={slug} className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={platformCategorySlugs.includes(slug)}
                    onChange={() => togglePlatformSlug(slug)}
                    className="rounded border-slate-300"
                  />
                  {label}
                </label>
              ))}
            </div>
            <Button type="button" size="sm" onClick={savePlatformCategories} disabled={platformSaving}>
              {platformSaving ? 'Saving…' : 'Save platform categories'}
            </Button>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Add category</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[200px]"
                placeholder="Category name (e.g. Burgers)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button type="button" size="sm" onClick={addCategory}>
                Add category
              </Button>
            </div>
            {categories.length > 0 && (
              <ul className="mt-3 text-sm text-slate-600 space-y-1">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                    <span>
                      {c.name} <span className="text-slate-400">({c.products?.length ?? 0} items)</span>
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => deleteCategory(c.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Add product</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct((x) => ({ ...x, name: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Price (PKR)"
                type="number"
                min={0}
                step={0.01}
                value={newProduct.price}
                onChange={(e) => setNewProduct((x) => ({ ...x, price: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Stock"
                type="number"
                value={newProduct.stock}
                onChange={(e) => setNewProduct((x) => ({ ...x, stock: e.target.value }))}
              />
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={newProduct.productCategoryId}
                onChange={(e) => setNewProduct((x) => ({ ...x, productCategoryId: e.target.value }))}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="block text-xs font-medium text-slate-600 mb-1">Product image</span>
                <GalleryImageInput
                  idPrefix="admin-new-product"
                  value={newProduct.imageUrl}
                  onChange={(url) => setNewProduct((x) => ({ ...x, imageUrl: url }))}
                />
              </div>
            </div>
            <Button type="button" className="mt-3" size="sm" onClick={addProduct}>
              Add product
            </Button>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">All products</h2>
              <p className="text-xs text-slate-500 mt-1">
                Delete only works for products that have never been on an order. Otherwise use <strong>Mark OOS</strong>{' '}
                or <strong>Edit</strong> → turn off Available.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-right p-3 font-medium">Price</th>
                    <th className="text-left p-3 font-medium">Variants</th>
                    <th className="text-right p-3 font-medium">Stock</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 align-top">
                      {editingId === p.id ? (
                        <>
                          <td className="p-3" colSpan={7}>
                            <div className="grid sm:grid-cols-2 gap-2">
                              <input
                                className="border rounded px-2 py-1.5 text-sm"
                                value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              />
                              <input
                                className="border rounded px-2 py-1.5 text-sm"
                                type="number"
                                value={editForm.price}
                                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                              />
                              <input
                                className="border rounded px-2 py-1.5 text-sm"
                                type="number"
                                value={editForm.stock}
                                onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))}
                              />
                              <select
                                className="border rounded px-2 py-1.5 text-sm"
                                value={editForm.productCategoryId}
                                onChange={(e) => setEditForm((f) => ({ ...f, productCategoryId: e.target.value }))}
                              >
                                <option value="">No category</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <div className="sm:col-span-2">
                                <span className="block text-xs font-medium text-slate-600 mb-1">Product image</span>
                                <GalleryImageInput
                                  idPrefix={`admin-edit-${editingId ?? 'p'}`}
                                  value={editForm.imageUrl}
                                  onChange={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))}
                                />
                              </div>
                              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                                <input
                                  type="checkbox"
                                  checked={editForm.isAvailable}
                                  onChange={(e) => setEditForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                                />
                                Available
                              </label>
                            </div>

                            <div className="mt-4 border-t border-slate-100 pt-4">
                              <h3 className="font-semibold text-slate-800 mb-2">Size / variants</h3>
                              <p className="text-xs text-slate-500 mb-3">
                                Add sizes like Small / Medium / Large with their own prices. If you add variants, customers will pick one before adding to cart.
                              </p>

                              <div className="grid sm:grid-cols-3 gap-2">
                                <input
                                  className="border rounded px-2 py-1.5 text-sm"
                                  placeholder="Variant name (e.g. Small)"
                                  value={newVariant.name}
                                  onChange={(e) => setNewVariant((v) => ({ ...v, name: e.target.value }))}
                                />
                                <input
                                  className="border rounded px-2 py-1.5 text-sm"
                                  placeholder="Price"
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={newVariant.price}
                                  onChange={(e) => setNewVariant((v) => ({ ...v, price: e.target.value }))}
                                />
                                <input
                                  className="border rounded px-2 py-1.5 text-sm"
                                  placeholder="Sort"
                                  type="number"
                                  value={newVariant.sortOrder}
                                  onChange={(e) => setNewVariant((v) => ({ ...v, sortOrder: e.target.value }))}
                                />
                              </div>
                              <Button type="button" size="sm" className="mt-2" onClick={addVariant}>
                                Add variant
                              </Button>

                              {(p.variants?.length ?? 0) > 0 ? (
                                <div className="mt-3 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="text-left p-2 font-medium">Name</th>
                                        <th className="text-right p-2 font-medium">Price</th>
                                        <th className="text-left p-2 font-medium">Available</th>
                                        <th className="text-right p-2 font-medium">Sort</th>
                                        <th className="p-2" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(p.variants ?? []).map((v) => (
                                        <tr key={v.id} className="border-t border-slate-100">
                                          <td className="p-2">
                                            <input
                                              className="border rounded px-2 py-1 text-xs w-full"
                                              defaultValue={v.name}
                                              onBlur={(e) => {
                                                const next = e.target.value.trim();
                                                if (next && next !== v.name) patchVariant(v.id, { name: next });
                                              }}
                                            />
                                          </td>
                                          <td className="p-2 text-right">
                                            <input
                                              className="border rounded px-2 py-1 text-xs w-28 text-right"
                                              type="number"
                                              min={0}
                                              step={0.01}
                                              defaultValue={String(Number(v.price))}
                                              onBlur={(e) => {
                                                const n = Number(e.target.value);
                                                if (!Number.isNaN(n) && n !== Number(v.price)) patchVariant(v.id, { price: n });
                                              }}
                                            />
                                          </td>
                                          <td className="p-2">
                                            <label className="inline-flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                defaultChecked={v.isAvailable}
                                                onChange={(e) => patchVariant(v.id, { isAvailable: e.target.checked })}
                                              />
                                              <span className="text-slate-600">Available</span>
                                            </label>
                                          </td>
                                          <td className="p-2 text-right">
                                            <input
                                              className="border rounded px-2 py-1 text-xs w-20 text-right"
                                              type="number"
                                              defaultValue={String(v.sortOrder ?? 0)}
                                              onBlur={(e) => {
                                                const n = Number(e.target.value);
                                                if (!Number.isNaN(n) && n !== Number(v.sortOrder ?? 0)) patchVariant(v.id, { sortOrder: n });
                                              }}
                                            />
                                          </td>
                                          <td className="p-2 text-right">
                                            <Button type="button" variant="outline" size="sm" onClick={() => deleteVariant(v.id)}>
                                              Delete
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-slate-500">No variants yet (item will use base price).</p>
                              )}
                            </div>

                            <div className="flex gap-2 mt-2">
                              <Button type="button" size="sm" onClick={saveProduct}>
                                Save
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 font-medium">{p.name}</td>
                          <td className="p-3 text-slate-600">{p.category?.name ?? '—'}</td>
                          <td className="p-3 text-right">Rs {Number(p.price).toLocaleString()}</td>
                          <td className="p-3 text-slate-600">
                            {p.variants && p.variants.length > 0
                              ? p.variants.map((v) => `${v.name} (${Number(v.price).toFixed(0)})`).join(', ')
                              : '—'}
                          </td>
                          <td className="p-3 text-right">{Number(p.stock)}</td>
                          <td className="p-3">
                            <span className={p.isOutOfStock || !p.isAvailable ? 'text-amber-700' : 'text-green-700'}>
                              {p.isOutOfStock || !p.isAvailable ? 'Unavailable' : 'Live'}
                            </span>
                          </td>
                          <td className="p-3 space-x-1 whitespace-nowrap text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => toggleOos(p)}>
                              {p.isOutOfStock ? 'Mark in stock' : 'Mark OOS'}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(p)}>
                              Edit
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => deleteProduct(p.id)}>
                              Delete
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {products.length === 0 && <p className="p-6 text-center text-slate-500">No products yet.</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
