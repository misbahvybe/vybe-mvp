import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async getOrCreateCustomer(userId: string, email: string | null, name: string): Promise<string> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    // Caller should check DB for existing stripeCustomerId first
    const customer = await this.stripe.customers.create({
      email: email ?? undefined,
      name,
      metadata: { userId },
    });
    return customer.id;
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<{ last4: string; brand: string }> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    await this.stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);
    const card = pm.card;
    if (!card) throw new Error('No card on payment method');
    const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
    return { last4: card.last4 ?? '0000', brand };
  }

  async createPaymentIntent(
    amountPaisas: number,
    customerId: string,
    paymentMethodId: string,
    metadata: Record<string, string>
  ): Promise<{ clientSecret: string; id: string }> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    const pi = await this.stripe.paymentIntents.create({
      amount: amountPaisas,
      currency: 'pkr',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: false,
      automatic_payment_methods: { enabled: false },
      metadata,
      off_session: true,
    });
    return { clientSecret: pi.client_secret ?? '', id: pi.id };
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<{ status: string; amount: number } | null> {
    if (!this.stripe) return null;
    try {
      const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return { status: pi.status, amount: pi.amount };
    } catch {
      return null;
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    if (!this.stripe) return;
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch {
      // Ignore - may already be detached
    }
  }
}
