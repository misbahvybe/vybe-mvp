'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';

const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.1.0';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';

interface Product {
  id: string;
  name: string;
  price: number;
  stock?: number;
  imageUrl: string | null;
  isAvailable?: boolean;
  isOutOfStock?: boolean;
}

interface Store {
  id: string;
  name: string;
  description: string | null;
  isOpenNow?: boolean;
  products: Product[];
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [store, setStore] = useState<Store | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const { items, storeId, total } = useCartStore();

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    const id = params?.id as string;
    if (!id) return;
    api
      .get<Store>(`/stores/${id}`)
      .then((res) => setStore(res.data))
      .catch(() => setStore(null));
  }, [token, router, params?.id]);

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title={store.name} backHref="/dashboard" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        {store.isOpenNow === false && (
          <div className="mb-4 p-4 rounded-card bg-amber-50 border border-amber-200">
            <p className="font-medium text-amber-800">Store is closed</p>
            <p className="text-sm text-amber-700">Orders are not accepted at this time. Please check back during business hours.</p>
          </div>
        )}
        {store.description && (
          <p className="text-slate-600 text-sm mb-4">{store.description}</p>
        )}
        <div className="space-y-4 pb-24">
          {store.products.map((p) => {
            const qty = storeId === store.id ? items.find((i) => i.productId === p.id)?.quantityKg ?? 0 : 0;
            const available = p.isAvailable !== false && !p.isOutOfStock;
            return (
              <Card key={p.id} className={`flex gap-4 transition-all duration-200 ${!available ? 'opacity-60' : ''}`}>
                <div className="w-20 h-20 rounded-button bg-slate-100 relative overflow-hidden shrink-0">
                  <Image
                    src={p.imageUrl || FALLBACK_PRODUCT_IMAGE}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  {!available && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                      <span className="text-white text-xs font-medium">Out of stock</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <p className="text-accent font-semibold">Rs {Number(p.price).toFixed(0)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {available && (
                    <>
                      {qty > 0 && (
                        <div className="flex items-center gap-1 min-h-[44px]">
                          <button
                            type="button"
                            onClick={() => updateQty(p.id, qty - 1)}
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
                        onClick={() => {
                          addItem({
                            productId: p.id,
                            storeId: store.id,
                            name: p.name,
                            unitPrice: Number(p.price),
                            quantityKg: 1,
                            imageUrl: p.imageUrl,
                          });
                        }}
                      >
                        +
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        <div className="fixed bottom-20 left-0 right-0 max-w-lg mx-auto px-4 safe-bottom">
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
      </main>
      </ContentPanel>
    </div>
  );
}
