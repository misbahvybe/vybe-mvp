import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  /** Unique line key: `${productId}:${variantId ?? ''}` */
  lineId: string;
  productId: string;
  variantId?: string | null;
  variantName?: string | null;
  storeId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string | null;
  calories?: number | null;
}

interface CartState {
  storeId: string | null;
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineId' | 'quantity'> & { quantity?: number }) => void;
  updateQty: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      items: [],
      addItem: (item) => {
        const qty = item.quantity ?? 1;
        const variantId = item.variantId ?? null;
        const lineId = `${item.productId}:${variantId ?? ''}`;
        set((state) => {
          if (state.storeId && state.storeId !== item.storeId) {
            return { storeId: item.storeId, items: [{ ...item, lineId, variantId, quantity: qty }] };
          }
          const existing = state.items.find((i) => i.lineId === lineId);
          if (existing) {
            return {
              storeId: item.storeId,
              items: state.items.map((i) =>
                i.lineId === lineId
                  ? { ...i, quantity: i.quantity + qty }
                  : i
              ),
            };
          }
          return {
            storeId: item.storeId,
            items: [...state.items, { ...item, lineId, variantId, quantity: qty }],
          };
        });
      },
      updateQty: (lineId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(lineId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.lineId === lineId ? { ...i, quantity } : i
          ),
        }));
      },
      removeItem: (lineId) =>
        set((state) => {
          const items = state.items.filter((i) => i.lineId !== lineId);
          return {
            items,
            storeId: items.length ? state.storeId : null,
          };
        }),
      clearCart: () => set({ storeId: null, items: [] }),
      total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    }),
    { name: 'vybe_cart' }
  )
);
