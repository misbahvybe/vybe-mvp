'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MdPayments } from 'react-icons/md';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import type { Address } from '@/types';

type OrderQuote = {
  subtotal: string;
  deliveryDistanceKm: string;
  deliveryFee: string;
  serviceFee: string;
  baseBeforeSurcharge: string;
  gstAmount: string;
  cardProcessingAmount: string;
  totalAmount: string;
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const { items, storeId, total, clearCart } = useCartStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const cartKey = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => ({ productId: i.productId, quantity: i.quantityKg, price: i.unitPrice })),
      ),
    [items],
  );

  useEffect(() => {
    if (!token || !storeId || !selectedAddressId || items.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    api
      .post<OrderQuote>('/orders/quote', {
        storeId,
        addressId: selectedAddressId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantityKg,
          price: i.unitPrice,
        })),
        paymentMethod: 'COD',
      })
      .then((r) => {
        if (!cancelled) setQuote(r.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, storeId, selectedAddressId, cartKey, items.length]);

  useEffect(() => {
    const err = searchParams?.get('error');
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    api.get<Address[]>('/users/me/addresses').then((res) => {
      setAddresses(res.data ?? []);
      const defaultAddr = (res.data ?? []).find((a) => a.isDefault) ?? (res.data ?? [])[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
    });
  }, [token, router]);

  const placeOrder = async () => {
    if (!selectedAddressId || !storeId || items.length === 0) {
      setError('Select a delivery address and ensure cart is not empty.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ id: string }>('/orders', {
        storeId,
        addressId: selectedAddressId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantityKg,
          price: i.unitPrice,
        })),
        paymentMethod: 'COD',
      });
      clearCart();
      router.push(`/order/${res.data.id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to place order';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canPlaceOrder = selectedAddressId && items.length > 0 && addresses.length > 0;

  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Checkout" backHref="/cart" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Delivery address</h2>
        {addresses.length === 0 ? (
          <Card className="mb-4">
            <p className="text-slate-600 text-sm mb-4">No saved address. Add one to place order.</p>
            <Link href="/addresses/new">
              <Button variant="outline" size="md" className="min-h-[44px]">Add address</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-2 mb-6">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedAddressId(addr.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedAddressId(addr.id)}
                className={`cursor-pointer ${selectedAddressId === addr.id ? 'ring-2 ring-primary rounded-card' : ''}`}
              >
                <Card>
                  <p className="font-medium text-slate-800">{addr.label || 'Address'}</p>
                  <p className="text-sm text-slate-600">{addr.fullAddress}</p>
                </Card>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-bold text-slate-800 mb-2">Payment method</h2>
        <div className="space-y-2 mb-6">
          <Card className="ring-2 ring-primary rounded-card">
            <div className="flex items-center gap-3">
              <MdPayments className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-medium text-slate-800">Cash on Delivery</p>
                <p className="text-xs text-slate-500">Pay when you receive</p>
              </div>
            </div>
          </Card>
        </div>

        <h2 className="text-lg font-bold text-slate-800 mb-2">Order summary</h2>
        <Card className="mb-4">
          {items.map((i) => (
            <div key={i.productId} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-slate-800">{i.name} × {i.quantityKg} kg</span>
              <span className="text-accent font-semibold">Rs {(i.unitPrice * i.quantityKg).toFixed(0)}</span>
            </div>
          ))}
          <div className="flex justify-between py-2 text-slate-600">
            <span>Subtotal</span>
            <span>Rs {quote ? Number(quote.subtotal).toFixed(0) : total().toFixed(0)}</span>
          </div>
          <div className="flex justify-between py-2 text-slate-600">
            <span>Delivery fee</span>
            <span>
              {quoteLoading ? '…' : quote ? `Rs ${Number(quote.deliveryFee).toFixed(0)}` : '—'}
            </span>
          </div>
          <div className="flex justify-between py-2 text-slate-600">
            <span>Service fee</span>
            <span>
              {quoteLoading ? '…' : quote ? `Rs ${Number(quote.serviceFee).toFixed(2)}` : '—'}
            </span>
          </div>
          {quote && Number(quote.gstAmount) > 0 && (
            <div className="flex justify-between py-2 text-slate-600">
              <span>GST (COD)</span>
              <span>Rs {Number(quote.gstAmount).toFixed(2)}</span>
            </div>
          )}
          {quote && (
            <p className="text-xs text-slate-500 mt-1">
              Distance ~{Number(quote.deliveryDistanceKm).toFixed(1)} km × rate (see platform settings)
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">Fast delivery</p>
          <div className="flex justify-between pt-3 font-bold text-slate-800">
            <span>Total</span>
            <span className="text-accent">
              {quoteLoading
                ? '…'
                : quote
                  ? `Rs ${Number(quote.totalAmount).toFixed(0)}`
                  : `Rs ${total().toFixed(0)}`}
            </span>
          </div>
        </Card>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!canPlaceOrder}
          onClick={placeOrder}
          className="min-h-[44px]"
        >
          Place order
        </Button>
      </main>
      </ContentPanel>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
