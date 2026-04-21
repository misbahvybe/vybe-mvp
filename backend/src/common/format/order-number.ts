/** Human-readable order label — single source for notifications and logs. Uses DB `orderNumber` when set. */
export function formatOrderNoForDisplay(orderNumber: number | null | undefined, orderId: string): string {
  if (orderNumber != null && Number.isFinite(Number(orderNumber))) {
    return `#${String(Math.trunc(Number(orderNumber))).padStart(4, '0')}`;
  }
  const compact = orderId.replace(/-/g, '');
  return `#${compact.length >= 8 ? compact.slice(-8).toUpperCase() : orderId}`;
}
