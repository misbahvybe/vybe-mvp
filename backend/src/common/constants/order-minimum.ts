import { BadRequestException } from '@nestjs/common';

/** Minimum cart subtotal (PKR) before delivery/service fees — applies to all checkout paths. */
export const MIN_ORDER_SUBTOTAL_PKR = 500;

export function assertMinOrderSubtotalPkr(subtotal: number): void {
  if (!Number.isFinite(subtotal) || subtotal < MIN_ORDER_SUBTOTAL_PKR) {
    throw new BadRequestException(
      `Minimum order is Rs ${MIN_ORDER_SUBTOTAL_PKR}. Add more items to your cart (current subtotal is too low).`,
    );
  }
}
