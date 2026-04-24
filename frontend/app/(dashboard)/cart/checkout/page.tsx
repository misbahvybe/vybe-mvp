'use client';

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
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
import { MIN_ORDER_SUBTOTAL_PKR } from '@/lib/orderMinimum';

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

type CheckoutEligibility = {
  manualMvpEnabled: boolean;
  firstOrderRulesActive: boolean;
  checkoutOtpRequired: boolean;
  deliveredOrderCount: number;
  canUseCod: boolean;
  otpSatisfied: boolean;
  isBlocked: boolean;
  phoneWarning: string | null;
  mvpAccountHints: Record<
    string,
    { accountNumber: string; accountTitle: string; openAppUrl: string | null } | null
  > | null;
};

type PaymentSelect =
  | 'COD'
  | 'MVP_JAZZCASH'
  | 'MVP_EASYPAISA'
  | 'MVP_BANK'
  | 'GW_JAZZCASH'
  | 'GW_EASYPAISA';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const { items, storeId, total: cartTotal, clearCart } = useCartStore();
  const subtotalPkr = cartTotal();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<CheckoutEligibility | null>(null);
  const [payment, setPayment] = useState<PaymentSelect>('COD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);

  const cartKey = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => ({ lineId: i.lineId, productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity, price: i.unitPrice })),
      ),
    [items],
  );

  const quotePaymentParam = useCallback((): 'COD' | 'CARD' | 'MANUAL' => {
    if (payment === 'COD') return 'COD';
    if (payment === 'MVP_JAZZCASH' || payment === 'MVP_EASYPAISA' || payment === 'MVP_BANK') return 'MANUAL';
    return 'CARD';
  }, [payment]);

  useEffect(() => {
    if (!token) return;
    api
      .get<CheckoutEligibility>('/orders/checkout/eligibility')
      .then((r) => {
        setEligibility(r.data ?? null);
        const e = r.data;
        if (e?.isBlocked) return;
        if (e && !e.canUseCod && e.manualMvpEnabled) {
          setPayment('MVP_JAZZCASH');
        }
      })
      .catch(() => setEligibility(null));
  }, [token]);

  useEffect(() => {
    if (!token || !storeId || !selectedAddressId || items.length === 0) {
      setQuote(null);
      return;
    }
    if (subtotalPkr < MIN_ORDER_SUBTOTAL_PKR) {
      setQuote(null);
      setQuoteLoading(false);
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
        paymentMethod: quotePaymentParam(),
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
  }, [token, storeId, selectedAddressId, cartKey, items.length, payment, subtotalPkr, quotePaymentParam]);

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

  const requestOtp = async () => {
    setOtpBusy(true);
    setError('');
    try {
      await api.post('/auth/checkout/request-otp', {});
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not send OTP';
      setError(msg);
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    if (!user?.phone) {
      setError('Missing account phone. Contact support.');
      return;
    }
    setOtpBusy(true);
    setError('');
    try {
      await api.post('/auth/checkout/verify-otp', { phone: user.phone, code: otpCode });
      const e = await api.get<CheckoutEligibility>('/orders/checkout/eligibility');
      setEligibility(e.data ?? null);
      setOtpCode('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid code';
      setError(msg);
    } finally {
      setOtpBusy(false);
    }
  };

  const placeOrder = async () => {
    if (!selectedAddressId || !storeId || items.length === 0) {
      setError('Select a delivery address and ensure cart is not empty.');
      return;
    }
    if (eligibility?.isBlocked) {
      setError('Your account cannot place orders. Contact support.');
      return;
    }
    if (eligibility?.checkoutOtpRequired && !eligibility?.otpSatisfied) {
      setError('Verify the OTP sent to your phone before placing the order.');
      return;
    }
    if (subtotalPkr < MIN_ORDER_SUBTOTAL_PKR) {
      setError(`Minimum order is Rs ${MIN_ORDER_SUBTOTAL_PKR}. Add more items to your cart.`);
      return;
    }
    if (!eligibility?.canUseCod && payment === 'COD') {
      setError('For your first order, choose an online payment method below.');
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

      if (payment === 'MVP_JAZZCASH' || payment === 'MVP_EASYPAISA' || payment === 'MVP_BANK') {
        const provider = payment === 'MVP_JAZZCASH' ? 'JAZZCASH' : payment === 'MVP_EASYPAISA' ? 'EASYPAISA' : 'BANK_MANUAL';
        const res = await api.post<{ id: string }>('/orders', {
          storeId,
          addressId: selectedAddressId,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? undefined,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
          paymentMethod: 'MANUAL_TRANSFER',
          manualTransferProvider: provider,
        });
        clearCart();
        router.push(`/order/${res.data.id}`);
        return;
      }

      const endpoint = payment === 'GW_JAZZCASH' ? '/orders/prepare-jazzcash' : '/orders/prepare-easypaisa';
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
      submitPostForm(prep.data.postUrl, prep.data.fields);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to place order';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const mvp = eligibility?.manualMvpEnabled;
  const canPlaceOrder =
    selectedAddressId &&
    items.length > 0 &&
    addresses.length > 0 &&
    subtotalPkr >= MIN_ORDER_SUBTOTAL_PKR &&
    !eligibility?.isBlocked;

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

        {eligibility?.phoneWarning && (
          <Card className="mb-4 border-amber-200 bg-amber-50/80">
            <p className="text-sm text-amber-900">{eligibility.phoneWarning}</p>
          </Card>
        )}

        {eligibility?.checkoutOtpRequired && (
          <Card className="mb-4">
            <p className="text-sm font-medium text-slate-800 mb-2">Phone verification</p>
            {eligibility.otpSatisfied ? (
              <p className="text-sm text-emerald-700">Phone verified for checkout. You are good to go.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  We will WhatsApp a code to the number on your account. Required when the platform has OTP enabled.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={requestOtp} disabled={otpBusy}>
                    Send code
                  </Button>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    className="border border-slate-200 rounded-md px-3 py-2 text-sm w-32 tracking-widest"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <Button type="button" variant="primary" size="sm" onClick={verifyOtp} disabled={otpBusy}>
                    Verify
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        <h2 className="text-lg font-bold text-slate-800 mb-2">Payment method</h2>
        <div className="space-y-2 mb-6">
          {eligibility?.canUseCod && (
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
          )}

          {mvp && (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPayment('MVP_JAZZCASH')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('MVP_JAZZCASH')}
                className={`cursor-pointer ${payment === 'MVP_JAZZCASH' ? 'ring-2 ring-primary rounded-card' : ''}`}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <MdPayments className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">JazzCash (transfer in app)</p>
                      <p className="text-xs text-slate-500">Pay to our number, then upload receipt on the next screen</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPayment('MVP_EASYPAISA')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('MVP_EASYPAISA')}
                className={`cursor-pointer ${payment === 'MVP_EASYPAISA' ? 'ring-2 ring-primary rounded-card' : ''}`}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <MdPayments className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">Easypaisa (transfer in app)</p>
                      <p className="text-xs text-slate-500">Pay to our number, then upload receipt on the next screen</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPayment('MVP_BANK')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('MVP_BANK')}
                className={`cursor-pointer ${payment === 'MVP_BANK' ? 'ring-2 ring-primary rounded-card' : ''}`}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <MdPayments className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">Bank transfer</p>
                      <p className="text-xs text-slate-500">IBAN or account on the next screen, then upload proof</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}

          {!mvp && (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPayment('GW_JAZZCASH')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('GW_JAZZCASH')}
                className={`cursor-pointer ${payment === 'GW_JAZZCASH' ? 'ring-2 ring-primary rounded-card' : ''}`}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <MdPayments className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">Pay with JazzCash</p>
                      <p className="text-xs text-slate-500">Redirect to JazzCash checkout (when API enabled)</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPayment('GW_EASYPAISA')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('GW_EASYPAISA')}
                className={`cursor-pointer ${payment === 'GW_EASYPAISA' ? 'ring-2 ring-primary rounded-card' : ''}`}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <MdPayments className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">Pay with Easypaisa</p>
                      <p className="text-xs text-slate-500">Redirect to Easypaisa checkout (when API enabled)</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>

        {mvp && payment.startsWith('MVP_') && quote && (
          <Card className="mb-4 bg-slate-50 border-slate-200">
            <p className="text-sm font-medium text-slate-800 mb-1">You will pay (exactly)</p>
            <p className="text-2xl font-bold text-primary">Rs {Number(quote.totalAmount).toFixed(0)}</p>
            <p className="text-xs text-slate-500 mt-2">After you place the order, open the payment app, send this amount, then upload a screenshot.</p>
          </Card>
        )}

        <h2 className="text-lg font-bold text-slate-800 mb-2">Order summary</h2>
        {subtotalPkr < MIN_ORDER_SUBTOTAL_PKR && items.length > 0 && (
          <Card className="mb-4 border-amber-200 bg-amber-50/80">
            <p className="text-sm text-amber-900">
              Minimum order is <span className="font-semibold">Rs {MIN_ORDER_SUBTOTAL_PKR}</span> (cart subtotal). Your
              subtotal is Rs {subtotalPkr.toFixed(0)} — add more items to continue.
            </p>
          </Card>
        )}
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
            <span>Rs {quote ? Number(quote.subtotal).toFixed(0) : subtotalPkr.toFixed(0)}</span>
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
          {quote && Number(quote.cardProcessingAmount) > 0 && !Number(quote.gstAmount) && (
            <div className="flex justify-between py-2 text-slate-600">
              <span>Card / online processing</span>
              <span>Rs {Number(quote.cardProcessingAmount).toFixed(2)}</span>
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
                  : `Rs ${subtotalPkr.toFixed(0)}`}
            </span>
          </div>
        </Card>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={
            !canPlaceOrder ||
            (eligibility?.checkoutOtpRequired && !eligibility?.otpSatisfied) ||
            (payment === 'COD' && !eligibility?.canUseCod)
          }
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
