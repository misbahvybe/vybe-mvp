/**
 * Maps backend order fields to a single primary rider action (step-based delivery UX).
 * Progress: 1 Assign → 2 At restaurant → 3 Pickup → 4 Deliver
 */

export type RiderDeliveryPrimary =
  | 'ACCEPT_ASSIGNMENT'
  | 'REJECT_ASSIGNMENT'
  | 'MARK_ARRIVED'
  | 'CONFIRM_PICKUP'
  | 'CONFIRM_DELIVER'
  | null;

export type RiderDeliveryUiState = {
  /** 1–4 for the progress indicator */
  progressStep: 1 | 2 | 3 | 4;
  /** Highlighted segment (may match progressStep or stay on 2 while waiting for kitchen) */
  highlightStep: 1 | 2 | 3 | 4;
  title: string;
  instruction: string;
  primary: RiderDeliveryPrimary;
  /** Secondary “Navigate” is optional; keep it subtle (outline/link), not a second primary */
  showNavigateToStore: boolean;
  showNavigateToCustomer: boolean;
  /** Waiting for store to mark ready (early reservation) */
  waitingForKitchen: boolean;
};

export type RiderOrderFlowFields = {
  orderStatus: string;
  riderId?: string | null;
  riderArrivedAt?: string | null;
};

const STEPS = ['Accept', 'Arrive', 'Pickup', 'Deliver'] as const;

export function riderStepLabels() {
  return STEPS;
}

export function getRiderDeliveryUiState(
  order: RiderOrderFlowFields,
  currentRiderId: string,
): RiderDeliveryUiState | null {
  if (order.riderId !== currentRiderId) return null;
  const s = order.orderStatus;
  if (s === 'DELIVERED' || s === 'CANCELLED' || s === 'STORE_REJECTED') return null;

  if (s === 'PICKED_UP') {
    return {
      progressStep: 4,
      highlightStep: 4,
      title: 'Deliver to customer',
      instruction: 'Go to the drop-off address and hand over the order.',
      primary: 'CONFIRM_DELIVER',
      showNavigateToStore: false,
      showNavigateToCustomer: true,
      waitingForKitchen: false,
    };
  }

  if (s === 'RIDER_ASSIGNED') {
    return {
      progressStep: 1,
      highlightStep: 1,
      title: 'New assignment',
      instruction: 'Review the order, then accept to start or reject to put it back in the pool.',
      primary: 'ACCEPT_ASSIGNMENT',
      showNavigateToStore: false,
      showNavigateToCustomer: false,
      waitingForKitchen: false,
    };
  }

  if ((s === 'PENDING' || s === 'STORE_ACCEPTED') && order.riderId) {
    if (!order.riderArrivedAt) {
      return {
        progressStep: 2,
        highlightStep: 2,
        title: 'Head to the restaurant',
        instruction: 'Go to the pickup location, then mark when you have arrived.',
        primary: 'MARK_ARRIVED',
        showNavigateToStore: true,
        showNavigateToCustomer: false,
        waitingForKitchen: false,
      };
    }
    return {
      progressStep: 2,
      highlightStep: 2,
      title: 'At restaurant — waiting',
      instruction:
        'The kitchen is still preparing this order. You will confirm pickup when it is marked ready.',
      primary: null,
      showNavigateToStore: true,
      showNavigateToCustomer: false,
      waitingForKitchen: true,
    };
  }

  if (s === 'READY_FOR_PICKUP' && order.riderId) {
    return {
      progressStep: 1,
      highlightStep: 1,
      title: 'Order ready at restaurant',
      instruction: 'Confirm you are taking this delivery before pickup.',
      primary: 'ACCEPT_ASSIGNMENT',
      showNavigateToStore: true,
      showNavigateToCustomer: false,
      waitingForKitchen: false,
    };
  }

  if (s === 'RIDER_ACCEPTED') {
    if (!order.riderArrivedAt) {
      return {
        progressStep: 2,
        highlightStep: 2,
        title: 'Go to the restaurant',
        instruction: 'Open maps if needed, then mark arrived when you are at the pickup point.',
        primary: 'MARK_ARRIVED',
        showNavigateToStore: true,
        showNavigateToCustomer: false,
        waitingForKitchen: false,
      };
    }
    return {
      progressStep: 3,
      highlightStep: 3,
      title: 'Pick up the order',
      instruction: 'Collect the package from the staff and confirm pickup when you have it.',
      primary: 'CONFIRM_PICKUP',
      showNavigateToStore: true,
      showNavigateToCustomer: false,
      waitingForKitchen: false,
    };
  }

  return null;
}
