import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

export type EasypaisaPrepareResult = {
  postUrl: string;
  fields: Record<string, string>;
  // where Easypaisa will redirect the browser with auth_token
  postBackUrl: string;
};

@Injectable()
export class EasypaisaService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const storeId = this.config.get<string>('EASYPAISA_STORE_ID') ?? '';
    const hashKey = this.config.get<string>('EASYPAISA_HASH_KEY') ?? '';
    return !!(storeId && hashKey);
  }

  getBaseUrl(): string {
    const isTest = (this.config.get<string>('EASYPAISA_TEST') ?? 'true') === 'true';
    return this.config.get<string>('EASYPAISA_BASE_URL') ?? (isTest ? 'https://easypaystg.easypaisa.com.pk' : 'https://easypay.easypaisa.com.pk');
  }

  getIndexUrl(): string {
    return `${this.getBaseUrl()}/easypay/Index.jsf`;
  }

  getConfirmUrl(): string {
    return `${this.getBaseUrl()}/easypay/Confirm.jsf`;
  }

  /** Same format as JazzCash: <=20 chars. */
  generateOrderRefNum(now = new Date()): string {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad2(now.getMonth() + 1);
    const dd = pad2(now.getDate());
    const HH = pad2(now.getHours());
    const mm = pad2(now.getMinutes());
    const ss = pad2(now.getSeconds());
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `EP${yyyy}${MM}${dd}${HH}${mm}${ss}${rand}`.slice(0, 20);
  }

  /**
   * Easypaisa "merchantHashedReq" for Post Method (Credit Card):
   * - Sort keys alphabetically
   * - Build querystring "key=value&key=value..."
   * - Encrypt with AES/ECB/PKCS5Padding using Hash Key
   * - Base64 encode ciphertext
   */
  merchantHashedReq(fields: Record<string, string>, hashKey: string): string {
    const entries = Object.entries(fields);
    entries.sort(([a], [b]) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
    const plain = entries.map(([k, v]) => `${k}=${v}`).join('&');

    const keyBuf = Buffer.from(hashKey, 'utf8');
    // Easypaisa hash key is typically 16 bytes for AES-128; allow 16/24/32.
    if (![16, 24, 32].includes(keyBuf.length)) {
      throw new Error('Easypaisa HASH KEY must be 16/24/32 bytes');
    }
    const algo = keyBuf.length === 16 ? 'aes-128-ecb' : keyBuf.length === 24 ? 'aes-192-ecb' : 'aes-256-ecb';
    const cipher = crypto.createCipheriv(algo, keyBuf, null);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
    return encrypted.toString('base64');
  }

  preparePostMethod(params: {
    amountPkr: number;
    orderRefNum: string;
    postBackUrl: string;
    emailAddr?: string | null;
    mobileNum?: string | null;
    autoRedirect?: '0' | '1';
    expiryDate?: string; // yyyymmdd HHMMSS
  }): EasypaisaPrepareResult {
    const storeId = this.config.get<string>('EASYPAISA_STORE_ID') ?? '';
    const hashKey = this.config.get<string>('EASYPAISA_HASH_KEY') ?? '';
    if (!storeId || !hashKey) throw new Error('Easypaisa is not configured');

    const baseFields: Record<string, string> = {
      amount: params.amountPkr.toFixed(1),
      autoRedirect: params.autoRedirect ?? '0',
      emailAddr: params.emailAddr ?? '',
      mobileNum: params.mobileNum ?? '',
      orderRefNum: params.orderRefNum,
      paymentMethod: 'CC_PAYMENT_METHOD',
      postBackURL: params.postBackUrl,
      storeId,
    };
    if (params.expiryDate) baseFields.expiryDate = params.expiryDate;

    const merchantHashedReq = this.merchantHashedReq(baseFields, hashKey);

    return {
      postUrl: this.getIndexUrl(),
      fields: {
        ...baseFields,
        merchantHashedReq,
      },
      postBackUrl: params.postBackUrl,
    };
  }
}

