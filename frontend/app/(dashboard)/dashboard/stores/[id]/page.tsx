'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock?: number;
  imageUrl: string | null;
  isAvailable?: boolean;
  isOutOfStock?: boolean;
  variants?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[];
}

interface Store {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  address?: string | null;
  isOpenNow?: boolean;
  products: Product[];
  productCategories?: { id: string; name: string; sortOrder: number; products: Product[] }[];
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<string, string>>({});
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const { items, storeId, total } = useCartStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    const id = params?.id as string;
    if (!id) return;
    let cancelled = false;
    setStore(null);
    setLoading(true);
    setLoadError(false);
    api
      .get<Store>(`/stores/${id}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        if (data && typeof data === 'object') {
          setStore(data);
          setLoadError(false);
        } else {
          setStore(null);
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStore(null);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, token, router, params?.id]);

  const productsList = store?.products ?? [];
  const availableProducts = useMemo(
    () => productsList.filter((p) => p.isAvailable !== false),
    [productsList],
  );
  const categorizedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of store?.productCategories ?? []) {
      for (const p of c.products ?? []) ids.add(p.id);
    }
    return ids;
  }, [store?.productCategories]);
  const uncategorized = useMemo(
    () => availableProducts.filter((p) => !categorizedIds.has(p.id)),
    [availableProducts, categorizedIds],
  );
  const sections = useMemo(
    () =>
      [
        ...(store?.productCategories ?? []).map((c) => ({
          title: c.name,
          items: (c.products ?? []).filter((p) => p.isAvailable !== false),
        })),
        ...(uncategorized.length > 0 ? [{ title: 'More', items: uncategorized }] : []),
      ].filter((s) => s.items.length > 0),
    [store?.productCategories, uncategorized],
  );

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col">
        <StickyHeader title="Store" backHref="/dashboard" />
        <ContentPanel bottomPadding="sm">
          <main className="app-shell-narrow py-8 flex flex-col items-center justify-center min-h-[40vh]">
            <Loader size={40} />
          </main>
        </ContentPanel>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <StickyHeader title="Loading…" backHref="/dashboard" />
        <ContentPanel bottomPadding="sm">
          <main className="app-shell-narrow py-8">
            <div className="flex flex-col items-center justify-center gap-3 min-h-[40vh] text-slate-600">
              <Loader size={44} />
              <p className="text-sm">Loading menu…</p>
            </div>
          </main>
        </ContentPanel>
      </div>
    );
  }

  if (loadError || !store) {
    return (
      <div className="min-h-screen flex flex-col">
        <StickyHeader title="Store" backHref="/dashboard" />
        <ContentPanel bottomPadding="sm">
          <main className="app-shell-narrow py-8">
            <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="font-medium text-amber-900">Could not load this store</p>
              <p className="text-sm text-amber-800 mt-1">
                Check your connection or try again. If the problem continues, the store may be unavailable.
              </p>
              <Link
                href="/dashboard"
                className="inline-block mt-4 text-sm font-semibold text-primary underline underline-offset-2"
              >
                Back to home
              </Link>
            </div>
          </main>
        </ContentPanel>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title={store.name} backHref="/dashboard" />
      <ContentPanel>
      <main className="app-shell-narrow py-4">
        {store.imageUrl && (
          <div className="aspect-video w-full max-h-48 rounded-card overflow-hidden bg-slate-100 mb-4 relative">
            <Image src={store.imageUrl} alt={store.name} fill className="object-cover" sizes="(max-width: 512px) 100vw, 512px" unoptimized />
          </div>
        )}
        {store.isOpenNow === false && (
          <div className="mb-4 p-4 rounded-card bg-amber-50 border border-amber-200">
            <p className="font-medium text-amber-800">Store is closed</p>
            <p className="text-sm text-amber-700">Orders are not accepted at this time. Please check back during business hours.</p>
          </div>
        )}
        {store.description && (
          <p className="text-slate-600 text-sm mb-4">{store.description}</p>
        )}
        {sections.length === 0 && (
          <p className="text-slate-600 text-sm py-8 text-center">No items on the menu right now.</p>
        )}
        <div className="pb-24 space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{section.title}</h2>
              <div className="space-y-4">
                {section.items.map((p) => {
                  const variants = (p.variants ?? []).filter((v) => v.isAvailable !== false);
                  const selectedVariantId = selectedVariantByProduct[p.id];
                  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
                  const lineId = `${p.id}:${selectedVariant?.id ?? ''}`;
                  const qty =
                    storeId === store.id
                      ? items.find((i) => i.lineId === lineId)?.quantity ?? 0
                      : 0;
                  const available = !p.isOutOfStock && store.isOpenNow !== false;
                  const unitPrice = selectedVariant ? Number(selectedVariant.price) : Number(p.price);
                  const mustPickVariant = variants.length > 0 && !selectedVariant;

                  return (
                    <Card key={p.id} className={`transition-all duration-200 ${!available ? 'opacity-60' : ''}`}>
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-button bg-white border border-slate-100 relative overflow-hidden shrink-0 flex items-center justify-center">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="80px" unoptimized />
                          ) : (
                            <Image src="/store-shelf.png" alt="" width={56} height={56} className="object-contain" />
                          )}
                          {!available && (
                            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                              <span className="text-white text-xs font-medium">Out of stock</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          {p.description ? (
                            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap border-l-2 border-primary/30 pl-2">
                              {p.description}
                            </p>
                          ) : null}
                          <p className="text-accent font-semibold mt-2">Rs {unitPrice.toFixed(0)}</p>

                          {variants.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {variants.map((v) => {
                                const active = v.id === selectedVariantId;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    disabled={!available}
                                    onClick={() => setSelectedVariantByProduct((m) => ({ ...m, [p.id]: v.id }))}
                                    className={`px-3 py-1.5 rounded-pill text-xs font-medium border transition-colors ${
                                      active
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                    } ${!available ? 'cursor-not-allowed' : ''}`}
                                  >
                                    {v.name}
                                    <span className="text-slate-500 font-normal"> · Rs {Number(v.price).toFixed(0)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {mustPickVariant && (
                            <p className="text-xs text-amber-700 mt-2">Select a size</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {available && (
                            <>
                              {qty > 0 && (
                                <div className="flex items-center gap-1 min-h-[44px]">
                                  <button
                                    type="button"
                                    onClick={() => updateQty(lineId, qty - 1)}
                                    className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-lg font-medium min-h-[44px] min-w-[44px]"
                                  >
                                    −
                                  </button>
                                  <span className="w-8 text-center font-medium">{qty}</span>
                                </div>
                              )}
                              <Button
                                variant="accent"
                                size="sm"
                                className="min-h-[44px] min-w-[44px]"
                                disabled={mustPickVariant}
                                onClick={() => {
                                  if (mustPickVariant) return;
                                  addItem({
                                    productId: p.id,
                                    variantId: selectedVariant?.id ?? null,
                                    variantName: selectedVariant?.name ?? null,
                                    storeId: store.id,
                                    name: p.name,
                                    unitPrice,
                                    quantity: 1,
                                    imageUrl: p.imageUrl,
                                  });
                                }}
                              >
                                +
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="fixed bottom-20 inset-x-0 safe-bottom z-30 pointer-events-none">
          <div className="app-shell-narrow pointer-events-auto">
            {store.isOpenNow === false ? (
              <Button variant="outline" size="lg" fullWidth className="min-h-[44px]" disabled>
                Store closed – orders unavailable
              </Button>
            ) : storeId === store.id && items.length > 0 ? (
              <>
                <div className="bg-white rounded-card shadow-soft-lg p-4 mb-2 flex justify-between items-center">
                  <span className="font-semibold text-slate-800">Cart total</span>
                  <span className="text-accent font-bold">Rs {total().toFixed(0)}</span>
                </div>
                <Link href="/cart">
                  <Button variant="primary" size="lg" fullWidth className="min-h-[44px]">
                    View Cart
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/cart">
                <Button variant="primary" size="lg" fullWidth className="min-h-[44px]">
                  View Cart
                </Button>
              </Link>
            )}
          </div>
        </div>
      </main>
      </ContentPanel>
    </div>
  );
}
