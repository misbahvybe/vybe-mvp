'use client';

import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#334155',
      '::placeholder': { color: '#94a3b8' },
    },
  },
};

interface StripeCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  isDefault: boolean;
  onDefaultChange: (v: boolean) => void;
  addCardWithStripe: (card: { paymentMethodId: string; isDefault: boolean }) => Promise<void>;
  saving: boolean;
  setSaving: (v: boolean) => void;
  setError: (v: string) => void;
  clearError: () => void;
}

export function StripeCardForm({
  onSuccess,
  onCancel,
  isDefault,
  onDefaultChange,
  addCardWithStripe,
  saving,
  setSaving,
  setError,
  clearError,
}: StripeCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    clearError();
    setSaving(true);
    try {
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element not found');
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardEl,
      });
      if (error) {
        setError(error.message ?? 'Card validation failed');
        return;
      }
      if (!paymentMethod?.id) {
        setError('Could not create payment method');
        return;
      }
      await addCardWithStripe({ paymentMethodId: paymentMethod.id, isDefault });
      onSuccess();
    } catch (err) {
      setError((err as Error).message ?? 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => onDefaultChange(e.target.checked)}
          className="rounded border-slate-300 text-primary"
        />
        <span className="text-sm text-slate-700">Set as default</span>
      </label>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Card details</label>
        <div className="px-4 py-3 rounded-button border border-slate-300 focus-within:ring-2 focus-within:ring-primary">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || saving}
          className="flex-1 min-h-[44px] px-4 py-3 rounded-button bg-primary text-white font-medium disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-4 py-3 rounded-button border-2 border-primary text-primary font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
