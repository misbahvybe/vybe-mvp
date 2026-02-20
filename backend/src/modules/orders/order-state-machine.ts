import { OrderStatus, Role } from '@prisma/client';

/** Strict transition rules: fromStatus -> (role -> toStatus[]) */
const TRANSITIONS: Record<OrderStatus, Partial<Record<Role, OrderStatus[]>>> = {
  PENDING: {
    CUSTOMER: ['CANCELLED'],
    STORE_OWNER: ['STORE_ACCEPTED', 'STORE_REJECTED'],
  },
  STORE_ACCEPTED: {
    STORE_OWNER: ['READY_FOR_PICKUP'],
  },
  STORE_REJECTED: {},
  READY_FOR_PICKUP: {
    ADMIN: ['RIDER_ASSIGNED'],
  },
  RIDER_ASSIGNED: {
    RIDER: ['RIDER_ACCEPTED', 'READY_FOR_PICKUP'],
  },
  RIDER_ACCEPTED: {
    RIDER: ['PICKED_UP'],
  },
  PICKED_UP: {
    RIDER: ['DELIVERED'],
  },
  DELIVERED: {},
  CANCELLED: {},
};

/** ADMIN can force cancel from any non-terminal status */
const CANCELABLE_BY_ADMIN: OrderStatus[] = [
  'PENDING',
  'STORE_ACCEPTED',
  'STORE_REJECTED',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'RIDER_ACCEPTED',
  'PICKED_UP',
];

export function canTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  role: Role
): boolean {
  if (toStatus === 'CANCELLED' && role === 'ADMIN') {
    return CANCELABLE_BY_ADMIN.includes(fromStatus) && fromStatus !== 'DELIVERED' && fromStatus !== 'CANCELLED';
  }
  const allowed = TRANSITIONS[fromStatus]?.[role];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

export function getAllowedTransitions(fromStatus: OrderStatus, role: Role): OrderStatus[] {
  const normal = TRANSITIONS[fromStatus]?.[role] ?? [];
  const adminCancel =
    role === 'ADMIN' && CANCELABLE_BY_ADMIN.includes(fromStatus) && fromStatus !== 'CANCELLED'
      ? (['CANCELLED'] as OrderStatus[])
      : [];
  return [...new Set([...normal, ...adminCancel])];
}
