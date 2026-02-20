'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Banknote, CreditCard, Coins } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { usePaymentMethodsStore } from '@/store/paymentMethodsStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import type { Address } from '@/types';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const DELIVERY_FEE = 150;
const SERVICE_FEE = 23.49; // Rs 23.49 per order per pitch

type PaymentOption = 'cod' | 'xpay' | { type: 'card'; cardId: string };

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const { items, storeId, total, clearCart } = useCartStore();
  const { cards, getDefault, fetchCards } = usePaymentMethodsStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentOption, setPaymentOption] = useState<PaymentOption | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<{ stripe: boolean; xpay: boolean }>({ stripe: false, xpay: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    api.get<{ stripe: boolean; xpay: boolean }>('/orders/payment-options').then((r) => setPaymentOptions(r.data ?? { stripe: false, xpay: false })).catch(() => {});
    fetchCards();
  }, [token, router, fetchCards]);

  useEffect(() => {
    if (paymentOptions.xpay && !paymentOptions.stripe) {
      setPaymentOption('cod');
    } else {
      const defaultCard = getDefault();
      if (defaultCard && paymentOptions.stripe) {
        setPaymentOption({ type: 'card', cardId: defaultCard.id });
      } else {
        setPaymentOption('cod');
      }
    }
  }, [cards.length, getDefault, paymentOptions.stripe, paymentOptions.xpay]);

  const placeOrder = async () => {
    if (!selectedAddressId || !storeId || items.length === 0) {
      setError('Select a delivery address and ensure cart is not empty.');
      return;
    }
    if (!paymentOption) {
      setError('Select a payment method.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (paymentOption === 'xpay') {
        const { data } = await api.post<{ redirectUrl: string }>('/orders/prepare-xpay', {
          storeId,
          addressId: selectedAddressId,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantityKg,
            price: i.unitPrice,
          })),
        });
        if (data?.redirectUrl) {
          clearCart();
          window.location.href = data.redirectUrl;
          return;
        }
        throw new Error('No redirect URL from XPay');
      }

      const orderPayload: Record<string, unknown> = {
        storeId,
        addressId: selectedAddressId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantityKg,
          price: i.unitPrice,
        })),
        paymentMethod: paymentOption === 'cod' ? 'COD' : 'CARD',
      };

      if (paymentOption !== 'cod' && typeof paymentOption === 'object' && paymentOption.type === 'card') {
        if (stripePromise && paymentOptions.stripe) {
          try {
            const amount = total() + DELIVERY_FEE + SERVICE_FEE;
            const { data: pi } = await api.post<{ clientSecret: string; paymentIntentId: string }>(
              '/orders/payment-intent',
              { amount, paymentMethodId: paymentOption.cardId }
            );
            const stripe = await stripePromise;
            if (stripe && pi?.clientSecret) {
              const { error: stripeErr } = await stripe.confirmCardPayment(pi.clientSecret);
              if (stripeErr) {
                setError(stripeErr.message ?? 'Payment failed');
                return;
              }
              orderPayload.paymentIntentId = pi.paymentIntentId;
            } else {
              orderPayload.paymentMethodId = paymentOption.cardId;
            }
          } catch {
            orderPayload.paymentMethodId = paymentOption.cardId;
          }
        } else {
          orderPayload.paymentMethodId = paymentOption.cardId;
        }
      }

      const res = await api.post<{ id: string }>('/orders', orderPayload);
      clearCart();
      router.push(`/order/${res.data.id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to place order';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canPlaceOrder = selectedAddressId && paymentOption && items.length > 0 && addresses.length > 0;

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
          <div
            role="button"
            tabIndex={0}
            onClick={() => setPaymentOption('cod')}
            onKeyDown={(e) => e.key === 'Enter' && setPaymentOption('cod')}
            className={`cursor-pointer ${paymentOption === 'cod' ? 'ring-2 ring-primary rounded-card' : ''}`}
          >
            <Card>
              <div className="flex items-center gap-3">
                <Banknote className="w-5 h-5 text-primary shrink-0" strokeWidth={2} />
                <div>
                  <p className="font-medium text-slate-800">Cash on Delivery</p>
                  <p className="text-xs text-slate-500">Pay when you receive</p>
                </div>
              </div>
            </Card>
          </div>
          {paymentOptions.xpay && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPaymentOption('xpay')}
              onKeyDown={(e) => e.key === 'Enter' && setPaymentOption('xpay')}
              className={`cursor-pointer ${paymentOption === 'xpay' ? 'ring-2 ring-primary rounded-card' : ''}`}
            >
              <Card>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-primary shrink-0" strokeWidth={2} />
                  <div>
                    <p className="font-medium text-slate-800">Card / JazzCash / EasyPaisa (XPay)</p>
                    <p className="text-xs text-slate-500">Pay securely with card or mobile wallet</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
          {paymentOptions.stripe && cards.map((card) => (
            <div
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => setPaymentOption({ type: 'card', cardId: card.id })}
              onKeyDown={(e) => e.key === 'Enter' && setPaymentOption({ type: 'card', cardId: card.id })}
              className={`cursor-pointer ${paymentOption && typeof paymentOption === 'object' && paymentOption.cardId === card.id ? 'ring-2 ring-primary rounded-card' : ''}`}
            >
              <Card>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-primary shrink-0" strokeWidth={2} />
                  <div>
                    <p className="font-medium text-slate-800">•••• {card.last4}</p>
                    <p className="text-xs text-slate-500">{card.cardType}</p>
                  </div>
                  {card.isDefault && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded ml-auto">Default</span>}
                </div>
              </Card>
            </div>
          ))}
          {paymentOptions.stripe && (
            <Link href="/profile/payment-methods">
              <Card className="border-2 border-dashed border-slate-300">
                <p className="text-primary font-medium text-center">+ Add new card</p>
              </Card>
            </Link>
          )}
          <div className="relative pointer-events-none select-none">
            <Card className="border-2 border-dashed border-slate-200 opacity-70">
              <div className="flex items-center gap-3">
                <Coins className="w-5 h-5 text-amber-500 shrink-0" strokeWidth={2} />
                <div>
                  <p className="font-medium text-slate-700">Crypto (Binance Wallet)</p>
                  <p className="text-xs text-slate-500">Pakistan&apos;s first regulated crypto payments</p>
                </div>
                <span className="ml-auto text-xs bg-slate-400 text-white px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
              </div>
            </Card>
          </div>
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
            <span>Rs {total().toFixed(0)}</span>
          </div>
          <div className="flex justify-between py-2 text-slate-600">
            <span>Delivery fee</span>
            <span>Rs {DELIVERY_FEE}</span>
          </div>
          <div className="flex justify-between py-2 text-slate-600">
            <span>Service fee</span>
            <span>Rs {SERVICE_FEE}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Delivery in 90–120 minutes</p>
          <div className="flex justify-between pt-3 font-bold text-slate-800">
            <span>Total</span>
            <span className="text-accent">Rs {(total() + DELIVERY_FEE + SERVICE_FEE).toFixed(0)}</span>
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
