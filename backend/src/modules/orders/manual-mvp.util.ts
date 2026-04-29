import { PendingPaymentProvider } from '@prisma/client';

function envOn(key: string): boolean {
  const v = (process.env[key] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** JazzCash / Easypaisa / bank transfer with screenshot (no live gateway). */
export function isManualMvpEnabled(): boolean {
  return envOn('VYBE_MANUAL_MVP');
}

/** How many of the customer’s first orders get waived delivery (default 2). */
export function freeDeliveryOrderCap(): number {
  const n = Number((process.env.VYBE_FREE_DELIVERY_ORDER_COUNT ?? '2').trim());
  if (!Number.isFinite(n) || n < 0) return 2;
  return Math.min(50, Math.floor(n));
}

/** When set, a fresh checkout OTP (WhatsApp) is required to place an order. */
export function isCheckoutOtpEnforced(): boolean {
  return envOn('VYBE_CHECKOUT_OTP');
}

/**
 * PENDING cancels that increment `orderStrikeCount` before the account is blocked.
 * Default 5. Set to `0` to disable anti-abuse.
 */
export function orderStrikeCancelThreshold(): number | null {
  const raw = (process.env.VYBE_ORDER_STRIKES_MAX ?? '5').trim();
  if (raw === '0' || raw.toLowerCase() === 'off' || raw.toLowerCase() === 'false') {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

const OTP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function checkoutOtpValidUntil(verifiedAt: Date = new Date()): Date {
  return new Date(verifiedAt.getTime() + OTP_WINDOW_MS);
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Heuristic: Pakistan mobile 03xx… (11 digits) or 92… (12 digits after normalizing with leading 0 dropped).
 * Returns a warning when the number is unlikely to be reachable on WhatsApp.
 */
export function pkPhoneHeuristicWarning(phone: string | null | undefined): string | null {
  if (!phone) return 'No phone on file.';
  const d = digitsOnly(phone);
  const n = d.length >= 10 ? d.slice(-10) : d;
  if (n.length === 10 && n.startsWith('3')) return null; // 3XXXXXXXXX
  if (d.startsWith('92') && d.length === 12 && d[2] === '3') return null;
  return 'This phone may be invalid for WhatsApp delivery updates. Check the number in your account.';
}

export function manualMvpAccountDisplay(
  provider: PendingPaymentProvider,
  env: NodeJS.ProcessEnv = process.env,
): { accountNumber: string; accountTitle: string; openAppUrl: string | null } | null {
  if (provider === 'JAZZCASH') {
    const accountNumber = (env.VYBE_MVP_JAZZCASH_NUMBER ?? '').trim();
    const accountTitle = (env.VYBE_MVP_JAZZCASH_TITLE ?? '').trim();
    if (!accountNumber) return null;
    const openAppUrl = (env.VYBE_MVP_JAZZCASH_APP_URL ?? 'jazzcash://').trim() || null;
    return { accountNumber, accountTitle: accountTitle || 'JazzCash', openAppUrl };
  }
  if (provider === 'EASYPAISA') {
    const accountNumber = (env.VYBE_MVP_EASYPAISA_NUMBER ?? '').trim();
    const accountTitle = (env.VYBE_MVP_EASYPAISA_TITLE ?? '').trim();
    if (!accountNumber) return null;
    const openAppUrl = (env.VYBE_MVP_EASYPAISA_APP_URL ?? 'https://easypaisa.com.pk/').trim() || null;
    return { accountNumber, accountTitle: accountTitle || 'Easypaisa', openAppUrl };
  }
  if (provider === 'BANK_MANUAL') {
    const acct = (env.VYBE_MVP_BANK_ACCOUNT ?? '').trim();
    const iban = (env.VYBE_MVP_BANK_IBAN ?? '').trim();
    const accountTitle = (env.VYBE_MVP_BANK_TITLE ?? '').trim();
    const parts: string[] = [];
    if (iban) parts.push(`IBAN: ${iban}`);
    if (acct) parts.push(`Account: ${acct}`);
    const accountNumber = parts.length > 0 ? parts.join(' · ') : iban || acct;
    if (!accountNumber) return null;
    return { accountNumber, accountTitle: accountTitle || 'Bank transfer', openAppUrl: null };
  }
  return null;
}

/** For checkout UI: separate fields + copy. Returns null if bank is not configured. */
export function bankManualMvpDisplaySplit(
  env: NodeJS.ProcessEnv = process.env,
): {
  bankName: string;
  accountTitle: string;
  iban: string;
  accountNumber: string;
} | null {
  const rawTitle = (env.VYBE_MVP_BANK_TITLE ?? '').trim();
  const iban = (env.VYBE_MVP_BANK_IBAN ?? '').trim();
  const accountNumber = (env.VYBE_MVP_BANK_ACCOUNT ?? '').trim();
  const bankName = (env.VYBE_MVP_BANK_NAME ?? 'MCB').trim() || 'Bank';
  if (!iban && !accountNumber) return null;
  return {
    bankName,
    accountTitle: rawTitle || 'Account holder',
    iban,
    accountNumber,
  };
}
