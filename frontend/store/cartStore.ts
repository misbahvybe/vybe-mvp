import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
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
  updateQty: (productId: string, quantityKg: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      items: [],
      addItem: (item) => {
        const qty = item.quantityKg ?? 1;
        set((state) => {
          if (state.storeId && state.storeId !== item.storeId) {
            return { storeId: item.storeId, items: [{ ...item, quantityKg: qty }] };
          }
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              storeId: item.storeId,
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantityKg: i.quantityKg + qty }
                  : i
              ),
            };
          }
          return {
            storeId: item.storeId,
            items: [...state.items, { ...item, quantityKg: qty }],
          };
        });
      },
      updateQty: (productId, quantityKg) => {
        if (quantityKg <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantityKg } : i
          ),
        }));
      },
      removeItem: (productId) =>
        set((state) => {
          const items = state.items.filter((i) => i.productId !== productId);
          return {
            items,
            storeId: items.length ? state.storeId : null,
          };
        }),
      clearCart: () => set({ storeId: null, items: [] }),
      total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantityKg, 0),
    }),
    { name: 'vybe_cart' }
  )
);
