import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

export type JazzCashEnv = {
  merchantId: string;
  password: string;
  integritySalt: string;
  postUrl: string;
};

export type JazzCashPrepareResult = {
  postUrl: string;
  fields: Record<string, string>;
};

@Injectable()
export class JazzCashService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const merchantId = this.config.get<string>('JAZZCASH_MERCHANT_ID') ?? '';
    const password = this.config.get<string>('JAZZCASH_PASSWORD') ?? '';
    const integritySalt = this.config.get<string>('JAZZCASH_INTEGRITY_SALT') ?? '';
    const postUrl = this.getPostUrl();
    return !!(merchantId && password && integritySalt && postUrl);
  }

  getPostUrl(): string {
    const isTest = (this.config.get<string>('JAZZCASH_TEST') ?? 'true') === 'true';
    // JazzCash typically provides separate sandbox/prod URLs; keep overrideable.
    return (
      this.config.get<string>('JAZZCASH_POST_URL') ??
      (isTest
        ? 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/'
        : 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/')
    );
  }

  /**
   * Generates pp_TxnRefNo (<= 20 chars) with good uniqueness.
   * Format: VY + yyyyMMddHHmmss + 4 random digits = 20 chars.
   */
  generateTxnRefNo(now = new Date()): string {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad2(now.getMonth() + 1);
    const dd = pad2(now.getDate());
    const HH = pad2(now.getHours());
    const mm = pad2(now.getMinutes());
    const ss = pad2(now.getSeconds());
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `VY${yyyy}${MM}${dd}${HH}${mm}${ss}${rand}`.slice(0, 20);
  }

  formatTxnDateTime(now = new Date()): string {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad2(now.getMonth() + 1);
    const dd = pad2(now.getDate());
    const HH = pad2(now.getHours());
    const mm = pad2(now.getMinutes());
    const ss = pad2(now.getSeconds());
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }

  /**
   * JazzCash "Secure Hash" (HMAC-SHA256) generation per their integration guide:
   * - include all request fields that begin with "pp_"
   * - sort by ASCII of field name
   * - concatenate values with '&' between (no trailing '&')
   * - prepend shared secret to this concatenated string
   * - HMAC-SHA256 using shared secret as key; hex output (often uppercase)
   */
  secureHash(fields: Record<string, string>, integritySalt: string): string {
    const ppEntries = Object.entries(fields).filter(([k]) => k.startsWith('pp_') && k !== 'pp_SecureHash');
    ppEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const valuesJoined = ppEntries.map(([, v]) => String(v ?? '')).join('&');
    const message = `${integritySalt}&${valuesJoined}`;
    const hmac = crypto.createHmac('sha256', Buffer.from(integritySalt, 'utf8'));
    hmac.update(Buffer.from(message, 'utf8'));
    return hmac.digest('hex').toUpperCase();
  }

  getEnvOrThrow(): JazzCashEnv {
    const merchantId = this.config.get<string>('JAZZCASH_MERCHANT_ID') ?? '';
    const password = this.config.get<string>('JAZZCASH_PASSWORD') ?? '';
    const integritySalt = this.config.get<string>('JAZZCASH_INTEGRITY_SALT') ?? '';
    const postUrl = this.getPostUrl();
    if (!merchantId || !password || !integritySalt || !postUrl) {
      throw new Error('JazzCash is not configured');
    }
    return { merchantId, password, integritySalt, postUrl };
  }

  /**
   * Builds the hosted checkout form fields.
   * Amount is in PKR but JazzCash expects "no decimals" (e.g. 100.00 => 10000).
   */
  prepareHostedCheckout(params: {
    amountPkr: number;
    txnRefNo: string;
    billReference: string;
    description: string;
    returnUrl: string;
    txnType?: 'PAY' | 'MWALLET' | 'OTC' | 'DD' | 'MIGS';
    customerEmail?: string | null;
    customerMobile?: string | null;
  }): JazzCashPrepareResult {
    const env = this.getEnvOrThrow();
    const now = new Date();
    const pp_TxnDateTime = this.formatTxnDateTime(now);
    const expiry = new Date(now.getTime() + 30 * 60 * 1000);
    const pp_TxnExpiryDateTime = this.formatTxnDateTime(expiry);
    const amount = Math.round(params.amountPkr * 100); // "no decimals" for PKR

    const fields: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: params.txnType ?? 'PAY',
      pp_Language: 'EN',
      pp_MerchantID: env.merchantId,
      pp_Password: env.password,
      pp_TxnRefNo: params.txnRefNo,
      pp_Amount: String(amount),
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime,
      pp_TxnExpiryDateTime,
      pp_BillReference: params.billReference,
      pp_Description: params.description,
      pp_ReturnURL: params.returnUrl,
    };

    // Optional pass-through fields (returned back to us)
    if (params.customerEmail) fields.ppmpf_1 = params.customerEmail;
    if (params.customerMobile) fields.ppmpf_2 = params.customerMobile;

    fields.pp_SecureHash = this.secureHash(fields, env.integritySalt);

    return { postUrl: env.postUrl, fields };
  }

  verifyCallback(body: Record<string, any>): { ok: boolean; reason?: string } {
    if (!this.isConfigured()) return { ok: false, reason: 'JazzCash not configured' };
    const env = this.getEnvOrThrow();
    const received = String(body.pp_SecureHash ?? body.pp_securehash ?? '');
    if (!received) return { ok: false, reason: 'Missing secure hash' };
    const normalizedBody: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k.startsWith('pp_')) normalizedBody[k] = String(v ?? '');
    }
    const expected = this.secureHash(normalizedBody, env.integritySalt);
    if (expected.toUpperCase() !== received.toUpperCase()) {
      return { ok: false, reason: 'Invalid secure hash' };
    }
    return { ok: true };
  }
}

