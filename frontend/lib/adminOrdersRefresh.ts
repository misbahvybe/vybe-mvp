/** Dispatched on any admin-relevant order create/update so pages use one shared socket. */
export const ADMIN_ORDERS_REFRESH = 'vybe:admin-orders-refresh';

export function emitAdminOrdersRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_ORDERS_REFRESH));
}
