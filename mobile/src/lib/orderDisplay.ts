const PAD = 4;

export function formatOrderNo(orderNumber: number | null | undefined, orderId?: string | null): string {
  if (orderNumber != null && Number.isFinite(Number(orderNumber))) {
    return `#${String(Math.trunc(Number(orderNumber))).padStart(PAD, '0')}`;
  }
  if (orderId) {
    const compact = orderId.replace(/-/g, '');
    return `#${compact.length >= 8 ? compact.slice(-8).toUpperCase() : orderId}`;
  }
  return '#----';
}
