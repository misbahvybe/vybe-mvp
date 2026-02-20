'use client';

import Link from 'next/link';
import Image from 'next/image';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCartStore } from '@/store/cartStore';

const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.1.0';

export default function CartPage() {
  const { items, updateQty, removeItem, total } = useCartStore();
  const totalAmount = total();

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Cart" backHref="/dashboard" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        {items.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-slate-600 mb-4">Your cart is empty</p>
            <Link href="/dashboard"><Button variant="accent">Browse stores</Button></Link>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.productId} className="flex gap-4">
                  <div className="w-20 h-20 rounded-button bg-slate-100 relative overflow-hidden shrink-0">
                    <Image
                      src={item.imageUrl || FALLBACK_PRODUCT_IMAGE}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    {item.calories != null && <p className="text-sm text-slate-500">{item.calories} cal</p>}
                    <p className="text-accent font-semibold text-sm">Rs {item.unitPrice.toFixed(0)}</p>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <button type="button" className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-lg" onClick={() => updateQty(item.productId, item.quantityKg + 1)}>+</button>
                    <span className="text-sm font-medium">{String(item.quantityKg).padStart(2, '0')}</span>
                    <button type="button" className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-lg" onClick={() => updateQty(item.productId, item.quantityKg - 1)}>−</button>
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-lg font-bold text-slate-800">Total amount Rs {totalAmount.toFixed(0)}</p>
            </div>
            <Link href="/cart/checkout" className="block mt-4">
              <Button variant="primary" size="lg" fullWidth>Checkout</Button>
            </Link>
          </>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
