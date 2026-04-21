/**
 * Business hours use wall-clock times in BUSINESS_TIMEZONE (default Asia/Karachi).
 * Overnight ranges (e.g. 16:00–03:00) are: open if time >= start OR time < end (next morning).
 */

const DEFAULT_TZ = 'Asia/Karachi';

export function getWallClockMinutesInTimeZone(now: Date, timeZone: string): number {
  const tz = timeZone?.trim() || DEFAULT_TZ;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export function isWithinBusinessWindow(
  openingTime: string,
  closingTime: string,
  nowMins: number,
): boolean {
  const [oh, om] = openingTime.split(':').map(Number);
  const [ch, cm] = closingTime.split(':').map(Number);
  const openMins = oh * 60 + om;
  const closeMins = ch * 60 + cm;

  if (openMins === closeMins) return true;

  if (openMins < closeMins) {
    return nowMins >= openMins && nowMins < closeMins;
  }

  // Overnight: e.g. 16:00 → 03:00 next calendar day
  return nowMins >= openMins || nowMins < closeMins;
}

export type StoreHoursInput = {
  isOpen: boolean;
  openingTime: string | null;
  closingTime: string | null;
  /** When false, treat as closed for ordering (manual pause) even during posted hours. */
  acceptingOrders?: boolean | null;
};

/** Wall-clock schedule only: `isOpen` + optional opening/closing window (ignores acceptingOrders). */
export function isStoreWithinPostedHours(
  store: Pick<StoreHoursInput, 'isOpen' | 'openingTime' | 'closingTime'>,
  options?: { timeZone?: string; now?: Date },
): boolean {
  if (!store.isOpen) return false;
  if (!store.openingTime || !store.closingTime) return true;

  const tz = options?.timeZone?.trim() || DEFAULT_TZ;
  const now = options?.now ?? new Date();
  const nowMins = getWallClockMinutesInTimeZone(now, tz);
  return isWithinBusinessWindow(store.openingTime, store.closingTime, nowMins);
}

export function computeStoreOpenNow(
  store: StoreHoursInput,
  options?: { timeZone?: string; now?: Date },
): boolean {
  if (store.acceptingOrders === false) return false;
  return isStoreWithinPostedHours(store, options);
}
