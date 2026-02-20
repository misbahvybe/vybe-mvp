import { create } from 'zustand';

export interface SavedCard {
  id: string;
  last4: string;
  cardType: 'Visa' | 'Mastercard';
  isDefault: boolean;
}

interface PaymentMethodsState {
  cards: SavedCard[];
  loading: boolean;
  error: string | null;
  fetchCards: () => Promise<void>;
  addCard: (card: { last4: string; cardType: 'Visa' | 'Mastercard'; isDefault: boolean }) => Promise<void>;
  addCardWithStripe: (card: { paymentMethodId: string; isDefault: boolean }) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  removeCard: (id: string) => Promise<void>;
  getDefault: () => SavedCard | null;
  clearError: () => void;
}

function mapApiToCard(api: { id: string; last4: string; brand: string; isDefault: boolean }): SavedCard {
  return {
    id: api.id,
    last4: api.last4,
    cardType: (api.brand === 'Mastercard' ? 'Mastercard' : 'Visa') as 'Visa' | 'Mastercard',
    isDefault: api.isDefault,
  };
}

export const usePaymentMethodsStore = create<PaymentMethodsState>((set, get) => {
  async function fetchCards() {
    set({ loading: true, error: null });
    try {
      const api = (await import('@/services/api')).default;
      const res = await api.get<{ id: string; last4: string; brand: string; isDefault: boolean }[]>(
        '/users/me/payment-methods'
      );
      set({
        cards: (res.data ?? []).map(mapApiToCard),
        loading: false,
        error: null,
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load cards';
      set({ cards: [], loading: false, error: msg });
    }
  }

  return {
    cards: [],
    loading: false,
    error: null,
    fetchCards,
    addCard: async (card) => {
      set({ error: null });
      try {
        const api = (await import('@/services/api')).default;
        const res = await api.post<{ id: string; last4: string; brand: string; isDefault: boolean }>(
          '/users/me/payment-methods',
          { last4: card.last4, cardType: card.cardType, isDefault: card.isDefault }
        );
        const newCard = mapApiToCard(res.data);
        set((s) => ({
          cards: card.isDefault ? s.cards.map((c) => ({ ...c, isDefault: false })).concat(newCard) : s.cards.concat(newCard),
          error: null,
        }));
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add card';
        set((s) => ({ ...s, error: msg }));
        throw e;
      }
    },
    addCardWithStripe: async (card) => {
      set({ error: null });
      try {
        const api = (await import('@/services/api')).default;
        const res = await api.post<{ id: string; last4: string; brand: string; isDefault: boolean }>(
          '/users/me/payment-methods',
          { paymentMethodId: card.paymentMethodId, isDefault: card.isDefault }
        );
        const newCard = mapApiToCard(res.data);
        set((s) => ({
          cards: card.isDefault ? s.cards.map((c) => ({ ...c, isDefault: false })).concat(newCard) : s.cards.concat(newCard),
          error: null,
        }));
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add card';
        set((s) => ({ ...s, error: msg }));
        throw e;
      }
    },
    setDefault: async (id) => {
      set({ error: null });
      try {
        const api = (await import('@/services/api')).default;
        await api.patch(`/users/me/payment-methods/${id}/default`);
        set((s) => ({
          cards: s.cards.map((c) => ({ ...c, isDefault: c.id === id })),
          error: null,
        }));
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to set default';
        set((s) => ({ ...s, error: msg }));
        throw e;
      }
    },
    removeCard: async (id) => {
      set({ error: null });
      try {
        const api = (await import('@/services/api')).default;
        await api.delete(`/users/me/payment-methods/${id}`);
        set((s) => ({ cards: s.cards.filter((c) => c.id !== id), error: null }));
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to remove card';
        set((s) => ({ ...s, error: msg }));
        throw e;
      }
    },
    getDefault: () => get().cards.find((c) => c.isDefault) ?? get().cards[0] ?? null,
    clearError: () => set({ error: null }),
  };
});

export function detectCardType(cardNumber: string): 'Visa' | 'Mastercard' {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'Mastercard';
  return 'Visa';
}
