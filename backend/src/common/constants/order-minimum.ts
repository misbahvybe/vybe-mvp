import { BadRequestException } from '@nestjs/common';

/** Default cart subtotal (PKR) before delivery/service fees when a store has no override. */
export const MIN_ORDER_SUBTOTAL_PKR = 500;

export function assertMinOrderSubtotalPkr(subtotal: number): void {
  if (!Number.isFinite(subtotal) || subtotal < MIN_ORDER_SUBTOTAL_PKR) {
    throw new BadRequestException(
      `Minimum order is Rs ${MIN_ORDER_SUBTOTAL_PKR}. Add more items to your cart (current subtotal is too low).`,
    );
  }
}

export function resolveStoreMinOrderSubtotalPkr(storeMinOrderValue?: number | null): number {
  if (storeMinOrderValue == null) return MIN_ORDER_SUBTOTAL_PKR;
  if (!Number.isFinite(storeMinOrderValue)) return MIN_ORDER_SUBTOTAL_PKR;
  return Math.max(0, Math.round(storeMinOrderValue));
}
