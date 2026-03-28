'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { GalleryImageInput } from '@/components/ui/GalleryImageInput';
import api from '@/services/api';
import { ArrowLeft, UtensilsCrossed } from 'lucide-react';

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
      api.get<{ id: string; name: string }[]>('/admin/stores').then((r) => {
        const s = (r.data ?? []).find((x) => x.id === storeId);
        return s?.name ?? '';
      }),
    ])
      .then(([cats, prods, name]) => {
        setCategories(cats);
        setProducts(prods);
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

  const deleteProduct = async (productId: string) => {
    if (!storeId || !confirm('Delete this product?')) return;
    try {
      await api.delete(`/admin/stores/${storeId}/products/${productId}`);
      fetchAll();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete product');
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
        Manage categories and products for <span className="font-semibold text-slate-800">{storeName || '…'}</span>
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
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-right p-3 font-medium">Price</th>
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
                          <td className="p-3" colSpan={6}>
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
