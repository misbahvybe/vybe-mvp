import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PendingPaymentProvider } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { PrepareXPayDto } from '../orders/dto/prepare-xpay.dto';

export type BankSlug = 'hbl' | 'meezan' | 'allied';

const BANK_SLUGS: BankSlug[] = ['hbl', 'meezan', 'allied'];

function slugToProvider(slug: BankSlug): PendingPaymentProvider {
  switch (slug) {
    case 'hbl':
      return 'BANK_HBL';
    case 'meezan':
      return 'BANK_MEEZAN';
    case 'allied':
      return 'BANK_ALLIED';
  }
}

function envPrefix(slug: BankSlug): string {
  return `BANK_${slug.toUpperCase()}`;
}

@Injectable()
export class BankPaymentsService {
  private readonly log = new Logger(BankPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly config: ConfigService,
  ) {}

  assertBankSlug(raw: string): BankSlug {
    const s = String(raw || '').toLowerCase().trim();
    if (!BANK_SLUGS.includes(s as BankSlug)) {
      throw new BadRequestException(`Unknown bank slug. Use one of: ${BANK_SLUGS.join(', ')}`);
    }
    return s as BankSlug;
  }

  /** URLs to register in the bank merchant portal (return + webhook). */
  urlsForBank(slug: BankSlug) {
    const backendUrl = (this.config.get<string>('BACKEND_URL') ?? 'http://localhost:4000').replace(/\/$/, '');
    return {
      bank: slug,
      customerReturnUrl: `${backendUrl}/api/v1/payments/banks/${slug}/return`,
      serverWebhookUrl: `${backendUrl}/api/v1/payments/banks/${slug}/webhook`,
      note: 'Register these HTTPS URLs with the bank. Method is usually POST for return; confirm in their integration guide.',
    };
  }

  isBankConfigured(slug: BankSlug): boolean {
    const p = envPrefix(slug);
    return this.config.get<string>(`${p}_CONFIGURED`) === 'true';
  }

  private isStoreOpen(store: { isOpen: boolean; openingTime: string | null; closingTime: string | null }): boolean {
    if (!store.isOpen) return false;
    if (!store.openingTime || !store.closingTime) return true;
    const now = new Date();
    const [oh, om] = store.openingTime.split(':').map(Number);
    const [ch, cm] = store.closingTime.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const openMins = oh * 60 + om;
    let closeMins = ch * 60 + cm;
    if (closeMins <= openMins) closeMins += 24 * 60;
    return nowMins >= openMins && nowMins < closeMins;
  }

  private async assertItemsAndSubtotal(
    storeId: string,
    items: { productId: string; variantId?: string; quantity: number; price?: number }[],
    options: { checkStock: boolean },
  ): Promise<{ subtotal: number }> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, storeId },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))] as string[];
    const variants = variantIds.length ? await this.prisma.productVariant.findMany({ where: { id: { in: variantIds } } }) : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));
    let subtotal = 0;
    for (const item of items) {
      const prod = productById.get(item.productId);
      if (!prod) throw new BadRequestException(`Product ${item.productId} not found`);
      if (options.checkStock) {
        const stock = Number(prod.stock);
        if (prod.isOutOfStock || stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${prod.name}. Available: ${stock} ${stock === 0 ? '(out of stock)' : ''}`,
          );
        }
      }
      const variant = item.variantId ? variantById.get(item.variantId) : null;
      if (item.variantId && (!variant || variant.productId !== prod.id)) {
        throw new BadRequestException(`Variant ${item.variantId} not found for ${prod.name}`);
      }
      if (variant && variant.isAvailable === false) {
        throw new BadRequestException(`Variant ${variant.name} is unavailable for ${prod.name}`);
      }
      const serverPrice = variant ? Number(variant.price) : Number(prod.price);
      if (item.price != null && Math.abs(Number(item.price) - serverPrice) > 0.02) {
        throw new BadRequestException(`Price mismatch for ${prod.name}`);
      }
      subtotal += item.quantity * serverPrice;
    }
    return { subtotal };
  }

  private generateMerchantRef(slug: BankSlug): string {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = pad2(now.getMonth() + 1);
    const dd = pad2(now.getDate());
    const HH = pad2(now.getHours());
    const mm = pad2(now.getMinutes());
    const ss = pad2(now.getSeconds());
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const prefix = slug === 'hbl' ? 'HB' : slug === 'meezan' ? 'MZ' : 'AL';
    return `${prefix}${yyyy}${MM}${dd}${HH}${mm}${ss}${rand}`.slice(0, 20);
  }

  /**
   * Creates a pending payment session and returns URLs + placeholder form payload.
   * When the bank shares real field names and signing rules, extend `postUrl` / `fields` from env or code.
   */
  async prepare(customerId: string, slug: BankSlug, dto: PrepareXPayDto) {
    if (!this.isBankConfigured(slug)) {
      const p = envPrefix(slug);
      throw new BadRequestException(
        `Bank "${slug}" is not enabled yet. Set ${p}_CONFIGURED=true and ${p}_POST_URL (and other keys from the bank) after you receive their integration pack. ` +
          `You can still register URLs: GET /api/v1/payments/banks/${slug}/urls`,
      );
    }

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId: customerId },
    });
    if (!address) throw new ForbiddenException('Address not found');
    const store = await this.prisma.store.findFirst({
      where: { id: dto.storeId, isApproved: true },
    });
    if (!store) throw new ForbiddenException('Store not found');
    if (!this.isStoreOpen(store)) {
      throw new BadRequestException('Store is closed. Please try again during business hours.');
    }

    const items = dto.items as { productId: string; variantId?: string; quantity: number; price?: number }[];
    const { subtotal: subtotalAmount } = await this.assertItemsAndSubtotal(dto.storeId, items, { checkStock: true });
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal: subtotalAmount,
      paymentMethod: 'CARD',
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const providerRef = this.generateMerchantRef(slug);
    const provider = slugToProvider(slug);

    const pending = await this.prisma.pendingPayment.create({
      data: {
        customerId,
        storeId: dto.storeId,
        addressId: dto.addressId,
        itemsJson: JSON.stringify(items),
        amountPkr: q.totalAmount,
        status: 'PENDING',
        expiresAt,
        provider,
        providerRef,
        providerPayloadJson: JSON.stringify({ bank: slug, phase: 'prepare' }),
      },
    });

    const p = envPrefix(slug);
    const postUrl = this.config.get<string>(`${p}_POST_URL`)?.trim() ?? '';
    if (!postUrl) {
      throw new BadRequestException(`Missing ${p}_POST_URL`);
    }

    const urls = this.urlsForBank(slug);

    // Placeholder fields — replace when bank docs specify names + signing.
    const fields: Record<string, string> = {
      merchant_reference: providerRef,
      amount_pkr: Number(q.totalAmount).toFixed(2),
      pending_id: pending.id,
    };

    return {
      pendingId: pending.id,
      merchantReference: providerRef,
      postUrl,
      fields,
      ...urls,
    };
  }

  async handleReturn(slug: BankSlug, query: Record<string, string>, body: Record<string, unknown>) {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    const merged = { ...body, ...query } as Record<string, unknown>;
    this.log.log(`Bank return [${slug}] queryKeys=${Object.keys(query).join(',')} bodyKeys=${Object.keys(body).join(',')}`);

    // Persist raw callback for debugging / future verification implementation
    const ref =
      String(merged.merchant_reference ?? merged.orderRefNum ?? merged.orderId ?? merged.pp_TxnRefNo ?? merged.reference ?? '');
    if (ref) {
      const provider = slugToProvider(slug);
      await this.prisma.pendingPayment
        .updateMany({
          where: { provider, providerRef: ref, status: 'PENDING' },
          data: { providerPayloadJson: JSON.stringify({ bank: slug, phase: 'return', merged }) },
        })
        .catch(() => undefined);
    }

    // Order completion requires bank-specific verification — do not mark paid here yet.
    return {
      redirect: `${frontendUrl}/cart/checkout?bank=${slug}&status=pending_implementation`,
    };
  }

  async handleWebhook(slug: BankSlug, body: unknown) {
    this.log.log(`Bank webhook [${slug}] received: ${JSON.stringify(body).slice(0, 500)}`);
    return { ok: true, receivedAt: new Date().toISOString() };
  }
}
