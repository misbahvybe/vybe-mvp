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
import { Loader } from '@/components/ui/Loader';
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
  codTaxPercent?: string;
  serviceFeeMode?: 'FIXED' | 'PERCENT';
  serviceFeePercent?: string;
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const { items, storeId, total, clearCart } = useCartStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [payment, setPayment] = useState<'COD' | 'JAZZCASH' | 'EASYPAISA'>('COD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const cartKey = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => ({ lineId: i.lineId, productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity, price: i.unitPrice })),
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
          variantId: i.variantId ?? undefined,
          quantity: i.quantity,
          price: i.unitPrice,
        })),
        paymentMethod: payment === 'COD' ? 'COD' : 'CARD',
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
  }, [token, storeId, selectedAddressId, cartKey, items.length, payment]);

  useEffect(() => {
    const err = searchParams?.get('error');
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    api.get<Address[]>('/users/me/addresses').then((res) => {
      setAddresses(res.data ?? []);
      const defaultAddr = (res.data ?? []).find((a) => a.isDefault) ?? (res.data ?? [])[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
    });
  }, [hasHydrated, token, router]);

  const submitPostForm = (postUrl: string, fields: Record<string, string>) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = postUrl;
    for (const [k, v] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  };

  const placeOrder = async () => {
    if (!selectedAddressId || !storeId || items.length === 0) {
      setError('Select a delivery address and ensure cart is not empty.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (payment === 'COD') {
        const res = await api.post<{ id: string }>('/orders', {
          storeId,
          addressId: selectedAddressId,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? undefined,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
          paymentMethod: 'COD',
        });
        clearCart();
        router.push(`/order/${res.data.id}`);
        return;
      }

      const endpoint = payment === 'JAZZCASH' ? '/orders/prepare-jazzcash' : '/orders/prepare-easypaisa';
      const prep = await api.post<{ postUrl: string; fields: Record<string, string> }>(endpoint, {
        storeId,
        addressId: selectedAddressId,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? undefined,
          quantity: i.quantity,
          price: i.unitPrice,
        })),
      });

      // After redirect payment, the gateway returns to backend callback which redirects to /order/:id.
      // Keep cart intact until we confirm paid order exists.
      submitPostForm(prep.data.postUrl, prep.data.fields);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to place order';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canPlaceOrder = selectedAddressId && items.length > 0 && addresses.length > 0;

  if (!hasHydrated) return null;
  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Checkout" backHref="/cart" />
      <ContentPanel>
      <main className="app-shell-narrow py-4">
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
          <div
            role="button"
            tabIndex={0}
            onClick={() => setPayment('COD')}
            onKeyDown={(e) => e.key === 'Enter' && setPayment('COD')}
            className={`cursor-pointer ${payment === 'COD' ? 'ring-2 ring-primary rounded-card' : ''}`}
          >
            <Card>
              <div className="flex items-center gap-3">
                <MdPayments className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Cash on Delivery</p>
                  <p className="text-xs text-slate-500">Pay when you receive</p>
                </div>
              </div>
            </Card>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => setPayment('JAZZCASH')}
            onKeyDown={(e) => e.key === 'Enter' && setPayment('JAZZCASH')}
            className={`cursor-pointer ${payment === 'JAZZCASH' ? 'ring-2 ring-primary rounded-card' : ''}`}
          >
            <Card>
              <div className="flex items-center gap-3">
                <MdPayments className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Pay with JazzCash</p>
                  <p className="text-xs text-slate-500">Redirect to JazzCash checkout</p>
                </div>
              </div>
            </Card>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => setPayment('EASYPAISA')}
            onKeyDown={(e) => e.key === 'Enter' && setPayment('EASYPAISA')}
            className={`cursor-pointer ${payment === 'EASYPAISA' ? 'ring-2 ring-primary rounded-card' : ''}`}
          >
            <Card>
              <div className="flex items-center gap-3">
                <MdPayments className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Pay with Easypaisa</p>
                  <p className="text-xs text-slate-500">Redirect to Easypaisa checkout</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-800 mb-2">Order summary</h2>
        <Card className="mb-4">
          {items.map((i) => (
            <div key={i.lineId} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-slate-800">
                {i.name}
                {i.variantName ? <span className="text-slate-500"> ({i.variantName})</span> : null}
                {' '}× {i.quantity}
              </span>
              <span className="text-accent font-semibold">Rs {(i.unitPrice * i.quantity).toFixed(0)}</span>
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
            <span>
              Service fee
              {quote?.serviceFeeMode === 'PERCENT' && quote.serviceFeePercent != null ? (
                <span className="text-slate-400 font-normal"> ({Number(quote.serviceFeePercent)}% of subtotal + delivery)</span>
              ) : null}
            </span>
            <span>
              {quoteLoading ? '…' : quote ? `Rs ${Number(quote.serviceFee).toFixed(2)}` : '—'}
            </span>
          </div>
          {quote && Number(quote.gstAmount) > 0 && (
            <div className="flex justify-between py-2 text-slate-600">
              <span>
                COD tax
                {quote.codTaxPercent != null ? (
                  <span className="text-slate-400 font-normal"> ({Number(quote.codTaxPercent)}%)</span>
                ) : null}
              </span>
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader size={44} />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
