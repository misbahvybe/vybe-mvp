'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StripeCardForm } from '@/components/payment/StripeCardForm';
import { usePaymentMethodsStore, detectCardType } from '@/store/paymentMethodsStore';
import { useAuthStore } from '@/store/authStore';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function PaymentMethodsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { cards, loading, error: storeError, fetchCards, addCard, addCardWithStripe, setDefault, removeCard, clearError } = usePaymentMethodsStore();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    cardHolderName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    isDefault: true,
  });

  useEffect(() => {
    if (!token) router.replace('/auth/login');
    else fetchCards();
  }, [token, router, fetchCards]);

  const maskCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(' ').slice(0, 19);
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleAddCard = async () => {
    setFormError('');
    clearError();
    const digits = form.cardNumber.replace(/\D/g, '');
    if (digits.length < 13) {
      setFormError('Enter a valid card number');
      return;
    }
    if (form.expiry.replace(/\D/g, '').length !== 4) {
      setFormError('Enter valid expiry (MM/YY)');
      return;
    }
    if (form.cvv.length < 3) {
      setFormError('Enter valid CVV');
      return;
    }
    if (!form.cardHolderName.trim()) {
      setFormError('Enter card holder name');
      return;
    }
    const last4 = digits.slice(-4);
    const cardType = detectCardType(digits);
    setSaving(true);
    try {
      await addCard({
        last4,
        cardType,
        isDefault: form.isDefault,
      });
      setForm({ cardHolderName: '', cardNumber: '', expiry: '', cvv: '', isDefault: true });
      setShowForm(false);
    } catch {
      // error shown by store
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefault(id);
    } catch {
      // error shown by store
    }
  };

  const handleRemoveCard = async (id: string) => {
    try {
      await removeCard(id);
    } catch {
      // error shown by store
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Payment Methods" backHref="/more" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        {(storeError || formError) && (
          <p className="text-red-600 text-sm mb-4">{storeError || formError}</p>
        )}
        {loading && cards.length === 0 && !showForm ? (
          <Card className="mb-4 py-8 text-center">
            <p className="text-slate-600 text-sm">Loading...</p>
          </Card>
        ) : cards.length === 0 && !showForm ? (
          <Card className="mb-4 py-8 text-center">
            <p className="text-slate-600 text-sm mb-4">No saved cards</p>
            <Button onClick={() => setShowForm(true)} size="lg" className="min-h-[44px]">
              Add New Card
            </Button>
          </Card>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {cards.map((card) => (
                <Card key={card.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-primary shrink-0" strokeWidth={2} />
                    <div>
                      <p className="font-medium text-slate-800">
                        •••• •••• •••• {card.last4}
                        {card.isDefault && (
                          <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded">Default</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{card.cardType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!card.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(card.id)}
                        className="text-sm text-primary font-medium"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveCard(card.id)}
                      className="text-sm text-red-600 font-medium"
                      aria-label="Remove card"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
            {showForm ? (
              <Card className="mb-4">
                <h3 className="font-semibold text-slate-800 mb-4">Add new card</h3>
                {stripePromise ? (
                  <Elements stripe={stripePromise}>
                    <StripeCardForm
                      onSuccess={() => {
                        setForm({ cardHolderName: '', cardNumber: '', expiry: '', cvv: '', isDefault: true });
                        setShowForm(false);
                      }}
                      onCancel={() => setShowForm(false)}
                      isDefault={form.isDefault}
                      onDefaultChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
                      addCardWithStripe={addCardWithStripe}
                      saving={saving}
                      setSaving={setSaving}
                      setError={setFormError}
                      clearError={clearError}
                    />
                  </Elements>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Card holder name</label>
                    <input
                      type="text"
                      value={form.cardHolderName}
                      onChange={(e) => setForm((f) => ({ ...f, cardHolderName: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
                    />
                    <label className="block text-sm font-medium text-slate-700 mb-2">Card number</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.cardNumber}
                      onChange={(e) => setForm((f) => ({ ...f, cardNumber: maskCardNumber(e.target.value) }))}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
                    />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Expiry</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.expiry}
                          onChange={(e) => setForm((f) => ({ ...f, expiry: formatExpiry(e.target.value) }))}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">CVV</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.cvv}
                          onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                          placeholder="123"
                          maxLength={4}
                          className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        checked={form.isDefault}
                        onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                        className="rounded border-slate-300 text-primary"
                      />
                      <span className="text-sm text-slate-700">Set as default</span>
                    </label>
                    <div className="flex gap-2">
                      <Button onClick={handleAddCard} loading={saving} disabled={saving} className="flex-1 min-h-[44px] min-w-[44px]">
                        Save card
                      </Button>
                      <Button variant="outline" onClick={() => setShowForm(false)} className="min-h-[44px] min-w-[44px]">
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ) : (
              <Button onClick={() => setShowForm(true)} variant="outline" fullWidth className="min-h-[44px] min-w-[44px]">
                Add New Card
              </Button>
            )}
          </>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
