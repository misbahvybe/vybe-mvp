import { create } from 'zustand';

export interface CartItem {
  lineId: string;
  productId: string;
  variantId?: string | null;
  variantName?: string | null;
  storeId: string;
  name: string;
  unitPrice: number;
  quantityKg: number;
  imageUrl?: string | null;
  calories?: number | null;
}

interface CartState {
  storeId: string | null;
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantityKg'> & { quantityKg?: number }) => void;
  updateQty: (lineId: string, quantityKg: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
  storeId: null,
  items: [],
  addItem: (item) => {
    const qty = item.quantityKg ?? 1;
    const lineId = item.lineId || `${item.productId}:${item.variantId ?? ''}`;
    set((state) => {
      if (state.storeId && state.storeId !== item.storeId) {
        return { storeId: item.storeId, items: [{ ...item, lineId, quantityKg: qty }] };
      }
      const existing = state.items.find((i) => i.lineId === lineId);
      if (existing) {
        return {
          storeId: item.storeId,
          items: state.items.map((i) =>
            i.lineId === lineId ? { ...i, quantityKg: i.quantityKg + qty } : i
          )
        };
      }
      return {
        storeId: item.storeId,
        items: [...state.items, { ...item, lineId, quantityKg: qty }]
      };
    });
  },
  updateQty: (lineId, quantityKg) => {
    if (quantityKg <= 0) {
      get().removeItem(lineId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.lineId === lineId ? { ...i, quantityKg } : i
      )
    }));
  },
  removeItem: (lineId) =>
    set((state) => {
      const items = state.items.filter((i) => i.lineId !== lineId);
      return {
        items,
        storeId: items.length ? state.storeId : null
      };
    }),
  clearCart: () => set({ storeId: null, items: [] }),
  total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantityKg, 0)
}));

