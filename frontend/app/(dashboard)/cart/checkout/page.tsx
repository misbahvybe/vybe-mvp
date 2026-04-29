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
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { getApiErrorMessage } from '@/lib/apiError';

type OrderQuote = {
  subtotal: string;
  deliveryDistanceKm: string;
  deliveryFee: string;
  deliveryFeeGross?: string;
  deliveryDiscount?: string;
  freeDeliveryApplied?: boolean;
  serviceFee: string;
  baseBeforeSurcharge: string;
  gstAmount: string;
  cardProcessingAmount: string;
  totalAmount: string;
  codTaxPercent?: string;
  serviceFeeMode?: 'FIXED' | 'PERCENT';
  serviceFeePercent?: string;
};

type BankManualDisplay = {
  bankName: string;
  accountTitle: string;
  iban: string;
  accountNumber: string;
};

type CheckoutEligibility = {
  manualMvpEnabled: boolean;
  checkoutOtpRequired: boolean;
  deliveredOrderCount: number;
  priorPlacedOrderCount?: number;
  freeDeliveryOrderCap?: number;
  qualifiesFreeDelivery?: boolean;
  canUseCod: boolean;
  otpSatisfied: boolean;
  isBlocked: boolean;
  phoneWarning: string | null;
  mvpAccountHints: Record<
    string,
    { accountNumber: string; accountTitle: string; openAppUrl: string | null } | null
  > | null;
  bankManualDisplay: BankManualDisplay | null;
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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [eligibilityFetchFailed, setEligibilityFetchFailed] = useState(false);
  const { copy: copyValue, toast: copyToast, clearToast: clearCopyToast } = useCopyToClipboard();

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
    if (payment === 'MVP_JAZZCASH' || payment === 'MVP_EASYPAISA') {
      setPayment('MVP_BANK');
    }
  }, [payment]);

  useEffect(() => {
    if (!token) return;
    setEligibilityFetchFailed(false);
    api
      .get<CheckoutEligibility>('/orders/checkout/eligibility')
      .then((r) => {
        setEligibility(r.data ?? null);
        setEligibilityFetchFailed(false);
      })
      .catch(() => {
        setEligibility(null);
        setEligibilityFetchFailed(true);
      });
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
      const msg = getApiErrorMessage(e, 'Could not send OTP');
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
      const msg = getApiErrorMessage(e, 'Invalid code');
      setError(msg);
    } finally {
      setOtpBusy(false);
    }
  };

  const placeOrder = async () => {
    if (!selectedAddressId || !storeId || items.length === 0) {
      setError('Select a delivery address and ensure your cart has items from a store.');
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

      if (payment === 'MVP_BANK') {
        if (!proofFile) {
          setError('Please upload a screenshot of your bank transfer. Your order is only created after we receive this proof.');
          return;
        }
        const fd = new FormData();
        fd.append(
          'payload',
          JSON.stringify({
            storeId,
            addressId: selectedAddressId,
            items: items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? undefined,
              quantity: i.quantity,
              price: i.unitPrice,
            })),
          }),
        );
        fd.append('file', proofFile);
        const res = await api.post<{ id: string }>('/orders/checkout/manual-bank/confirm', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        clearCart();
        setProofFile(null);
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
      console.error('[checkout] placeOrder failed', e);
      setError(getApiErrorMessage(e, 'Failed to place order'));
    } finally {
      setLoading(false);
    }
  };

  const mvp = eligibility?.manualMvpEnabled;
  const bankDisplay = eligibility?.bankManualDisplay;
  const needsProofUpload = mvp && payment === 'MVP_BANK';
  const canPlaceOrder =
    Boolean(storeId) &&
    selectedAddressId &&
    items.length > 0 &&
    addresses.length > 0 &&
    subtotalPkr >= MIN_ORDER_SUBTOTAL_PKR &&
    !eligibility?.isBlocked &&
    (!needsProofUpload || Boolean(proofFile));

  const otpBlocksPlace =
    Boolean(eligibility?.checkoutOtpRequired && !eligibility?.otpSatisfied);
  const bankMvpMisconfigured = payment === 'MVP_BANK' && !eligibility?.bankManualDisplay;

  const placeOrderDisabled =
    !canPlaceOrder || otpBlocksPlace || bankMvpMisconfigured;

  const placeOrderDisabledHints = useMemo(() => {
    const hints: string[] = [];
    if (!addresses.length) hints.push('Add a saved delivery address.');
    else if (!selectedAddressId) hints.push('Select a delivery address.');
    if (!items.length) hints.push('Your cart is empty — go back to the store and add items.');
    if (items.length > 0 && !storeId) hints.push('Cart is missing store — clear the cart and add items again from one store.');
    if (items.length > 0 && subtotalPkr < MIN_ORDER_SUBTOTAL_PKR) {
      hints.push(`Cart subtotal must be at least Rs ${MIN_ORDER_SUBTOTAL_PKR} (before fees).`);
    }
    if (eligibility?.isBlocked) hints.push('This account cannot place orders — contact support.');
    if (needsProofUpload && !proofFile) hints.push('Upload a payment screenshot for bank transfer.');
    if (otpBlocksPlace) hints.push('Verify the checkout code sent to your phone (WhatsApp OTP is required on this platform).');
    if (bankMvpMisconfigured) {
      hints.push(
        'Bank transfer is not configured on the server. Choose Cash on delivery or ask the admin to set VYBE_MVP_BANK_* variables.',
      );
    }
    if (eligibilityFetchFailed && !otpBlocksPlace) {
      hints.push(
        'Could not load checkout rules from the server. You can still try — if it fails, refresh or check NEXT_PUBLIC_API_URL / Railway.',
      );
    }
    return hints;
  }, [
    addresses.length,
    selectedAddressId,
    storeId,
    items.length,
    subtotalPkr,
    eligibility?.isBlocked,
    needsProofUpload,
    proofFile,
    otpBlocksPlace,
    bankMvpMisconfigured,
    eligibilityFetchFailed,
  ]);

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

        {eligibility?.qualifiesFreeDelivery && (
          <Card className="mb-4 border-emerald-200 bg-emerald-50/80">
            <p className="text-sm text-emerald-900 font-medium">First orders offer</p>
            <p className="text-xs text-emerald-800 mt-1">
              Delivery fee is waived on your first {eligibility.freeDeliveryOrderCap ?? 2} orders (see breakdown below).
            </p>
          </Card>
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
        {mvp && (
          <p className="text-sm text-slate-600 mb-2">
            <span className="font-semibold text-slate-800">Online payment</span> — bank transfer with proof. Order is
            created only after you upload your screenshot.
          </p>
        )}
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

          {mvp && (
            <>
              <div className="opacity-60 pointer-events-none" aria-disabled="true">
                <Card className="border-dashed border-slate-200">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <MdPayments className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-600">JazzCash</p>
                        <p className="text-xs text-slate-500">Coming soon — not available for checkout yet</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Disabled</span>
                  </div>
                </Card>
              </div>
              <div className="opacity-60 pointer-events-none mt-2" aria-disabled="true">
                <Card className="border-dashed border-slate-200">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <MdPayments className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-600">Easypaisa</p>
                        <p className="text-xs text-slate-500">Coming soon — not available for checkout yet</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Disabled</span>
                  </div>
                </Card>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPayment('MVP_BANK')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('MVP_BANK')}
                className={`cursor-pointer mt-2 ${payment === 'MVP_BANK' ? 'ring-2 ring-primary rounded-card' : ''}`}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <MdPayments className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">Bank transfer (recommended)</p>
                      <p className="text-xs text-slate-500">
                        Transfer to our business account, then upload your payment screenshot — your order is created only after you upload proof
                      </p>
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

        {copyToast && (
          <div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm shadow-lg"
            role="status"
            aria-live="polite"
          >
            {copyToast}
            <button
              type="button"
              className="ml-3 text-slate-300 hover:text-white text-xs"
              onClick={() => clearCopyToast()}
            >
              Dismiss
            </button>
          </div>
        )}

        {mvp && payment === 'MVP_BANK' && quote && bankDisplay && (
          <Card className="mb-4 border-primary/25 bg-slate-50">
            <p className="text-sm font-semibold text-slate-800 mb-3">Pay by bank transfer</p>
            <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4 space-y-1 list-disc list-inside">
              <li>Transfer the <span className="font-semibold">exact amount</span> (PKR) — do not round.</li>
              <li>
                <span className="font-semibold">Upload a screenshot to confirm your order</span> (after the transfer
                is complete).
              </li>
              <li>Your order is <span className="font-semibold">not</span> sent to the restaurant until we verify your payment.</li>
            </ul>
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-3">
              Order will not be processed without payment. No order exists in our system until you submit your
              screenshot.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Bank name</p>
                <p className="font-medium text-slate-900">{bankDisplay.bankName}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Account title</p>
                <p className="font-medium text-slate-900">{bankDisplay.accountTitle}</p>
              </div>
              {bankDisplay.iban ? (
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-500 text-xs">IBAN</p>
                    <p className="font-mono text-slate-900 break-all">{bankDisplay.iban}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => copyValue(bankDisplay.iban)}
                  >
                    Copy
                  </button>
                </div>
              ) : null}
              {bankDisplay.accountNumber ? (
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-500 text-xs">Account number</p>
                    <p className="font-mono text-slate-900 break-all">{bankDisplay.accountNumber}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => copyValue(bankDisplay.accountNumber)}
                  >
                    Copy
                  </button>
                </div>
              ) : null}
              <div className="pt-2 border-t border-slate-200">
                <p className="text-slate-500 text-xs">Amount to pay (exactly)</p>
                <p className="text-2xl font-bold text-primary">Rs {Number(quote.totalAmount).toFixed(0)}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-800 mb-2">Upload screenshot to confirm order</p>
              <p className="text-xs text-slate-500 mb-2">
                Clear image of the successful transfer (reference or receipt visible if possible).
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="text-sm w-full"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setProofFile(f);
                }}
              />
            </div>
          </Card>
        )}

        {mvp && payment === 'MVP_BANK' && quote && !bankDisplay && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-900">Bank details are not configured. You cannot use bank transfer until the server has VYBE_MVP_BANK_* set.</p>
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
          {quote && quote.freeDeliveryApplied && quote.deliveryFeeGross != null && Number(quote.deliveryFeeGross) > 0 ? (
            <>
              <div className="flex justify-between py-2 text-slate-600">
                <span>Delivery fee (list)</span>
                <span>Rs {Number(quote.deliveryFeeGross).toFixed(0)}</span>
              </div>
              <div className="flex justify-between py-2 text-emerald-800">
                <span>First-orders delivery discount</span>
                <span>− Rs {Number(quote.deliveryDiscount ?? quote.deliveryFeeGross).toFixed(0)}</span>
              </div>
              <div className="flex justify-between py-2 text-slate-800 font-medium">
                <span>Total delivery</span>
                <span>Rs {Number(quote.deliveryFee).toFixed(0)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-2 text-slate-600">
              <span>Delivery fee</span>
              <span>
                {quoteLoading ? '…' : quote ? `Rs ${Number(quote.deliveryFee).toFixed(0)}` : '—'}
              </span>
            </div>
          )}
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
              <span>
                {quotePaymentParam() === 'MANUAL'
                  ? 'Online payment processing'
                  : 'Card / online processing'}
              </span>
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
          disabled={placeOrderDisabled}
          onClick={placeOrder}
          className="min-h-[44px]"
        >
          {payment === 'MVP_BANK' ? 'Submit payment & place order' : 'Place order'}
        </Button>
        {placeOrderDisabled && placeOrderDisabledHints.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            <p className="font-medium text-amber-900">Why you can&apos;t place the order yet</p>
            <ul className="mt-1.5 list-disc list-inside space-y-0.5">
              {placeOrderDisabledHints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        )}
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
