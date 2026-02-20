import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface XPayCreateIntentParams {
  amountPkr: number;
  customer: { name: string; email: string | null; phone: string };
  orderReference: string;
  callbackUrl: string;
  cancelUrl?: string;
  shipping?: {
    address1: string;
    city: string;
    country: string;
    province?: string;
    zip?: string;
  };
}

export interface XPayIntentResponse {
  success: boolean;
  intentId?: string;
  clientSecret?: string;
  encryptionKey?: string;
  redirectUrl?: string;
  error?: string;
}

@Injectable()
export class XPayService {
  private readonly apiKey: string | null;
  private readonly accountId: string | null;
  private readonly secret: string | null;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('XPAY_API_KEY') ?? null;
    this.accountId = this.config.get<string>('XPAY_ACCOUNT_ID') ?? null;
    this.secret = this.config.get<string>('XPAY_SECRET') ?? null;
    const isTest = this.config.get<string>('XPAY_TEST') === 'true';
    this.baseUrl = isTest
      ? 'https://xstak-pay-stg.xstak.com'
      : this.config.get<string>('XPAY_BASE_URL') ?? 'https://xstak-pay-stg.xstak.com';
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.accountId);
  }

  async createPaymentIntent(params: XPayCreateIntentParams): Promise<XPayIntentResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'XPay is not configured' };
    }

    try {
      const body = {
        amount: Math.round(params.amountPkr),
        currency: 'PKR',
        payment_method_types: 'card',
        customer: {
          name: params.customer.name,
          email: params.customer.email ?? '',
          phone: params.customer.phone.replace(/\D/g, '').replace(/^0/, '92'),
        },
        shipping: {
          address1: params.shipping?.address1 ?? '',
          city: params.shipping?.city ?? 'Lahore',
          country: 'Pakistan',
          province: params.shipping?.province ?? '',
          zip: params.shipping?.zip ?? '',
        },
        metadata: {
          order_reference: params.orderReference,
        },
        callback_url: params.callbackUrl,
        cancel_url: params.cancelUrl,
        gateway_instance_id: this.config.get<string>('XPAY_GATEWAY_INSTANCE_ID') ?? '',
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'x-account-id': this.accountId!,
      };

      if (this.secret) {
        const signature = this.generateSignature(JSON.stringify(body));
        headers['x-signature'] = signature;
      }

      const res = await fetch(`${this.baseUrl}/public/v1/payment/intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          error: data.message ?? data.error ?? `XPay API error: ${res.status}`,
        };
      }

      const intentId = data.id ?? data.payment_intent_id ?? data.paymentIntentId;
      const clientSecret = data.client_secret ?? data.clientSecret;
      const encryptionKey = data.encryption_key ?? data.encryptionKey;
      const redirectUrl = data.redirect_url ?? data.fwdUrl ?? data.url;

      return {
        success: true,
        intentId,
        clientSecret,
        encryptionKey,
        redirectUrl,
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: err };
    }
  }

  async verifyPayment(intentId: string): Promise<{ status: string; amount?: number } | null> {
    if (!this.isConfigured()) return null;

    try {
      const headers: Record<string, string> = {
        'x-api-key': this.apiKey!,
        'x-account-id': this.accountId!,
      };

      const res = await fetch(`${this.baseUrl}/public/v1/payment/intent/${intentId}`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      return {
        status: data.status ?? data.payment_status ?? 'unknown',
        amount: data.amount ?? data.amount_pkr,
      };
    } catch {
      return null;
    }
  }

  private generateSignature(payload: string): string {
    if (!this.secret) return '';
    const crypto = require('crypto');
    return crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
  }
}
