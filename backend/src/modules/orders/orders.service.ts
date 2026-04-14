import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { XPayService } from '../xpay/xpay.service';
import { JazzCashService } from '../jazzcash/jazzcash.service';
import { EasypaisaService } from '../easypaisa/easypaisa.service';
import { OrderStatus, Product, ProductVariant, Role } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PrepareXPayDto } from './dto/prepare-xpay.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { EditOrderItemDto } from './dto/edit-order-item.dto';
import { OrderQuoteDto } from './dto/order-quote.dto';
import { canTransition, getAllowedTransitions } from './order-state-machine';
import { Decimal } from '@prisma/client/runtime/library';
import { PricingService } from '../pricing/pricing.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { StoresService } from '../stores/stores.service';
import { RidersService } from '../riders/riders.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Set `false` when Stripe / XPay keys are ready and clients show those options again. */
const PAYMENTS_COD_ONLY = true;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly xpay: XPayService,
    private readonly jazzcash: JazzCashService,
    private readonly easypaisa: EasypaisaService,
    private readonly config: ConfigService,
    private readonly pricing: PricingService,
    private readonly ordersGateway: OrdersGateway,
    private readonly stores: StoresService,
    private readonly riders: RidersService,
    private readonly notifications: NotificationsService,
  ) {}

  async prepareJazzCash(customerId: string, dto: PrepareXPayDto) {
    // NOTE: We reuse PrepareXPayDto shape: storeId, addressId, items.
    // This keeps frontend changes small.
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
    if (!this.jazzcash.isConfigured()) {
      throw new BadRequestException('JazzCash is not configured');
    }

    const { subtotal: subtotalAmount } = await this.assertItemsAndSubtotal(this.prisma, dto.storeId, dto.items, {
      checkStock: true,
    });
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal: subtotalAmount,
      paymentMethod: 'CARD',
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      select: { email: true, phone: true },
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const txnRefNo = this.jazzcash.generateTxnRefNo();
    const pending = await this.prisma.pendingPayment.create({
      data: {
        customerId,
        storeId: dto.storeId,
        addressId: dto.addressId,
        itemsJson: JSON.stringify(dto.items),
        amountPkr: q.totalAmount,
        status: 'PENDING',
        expiresAt,
        provider: 'JAZZCASH' as any,
        providerRef: txnRefNo,
      },
    });

    const backendUrl = this.config.get<string>('BACKEND_URL') ?? 'http://localhost:4000';
    const returnUrl = `${backendUrl}/api/v1/orders/jazzcash-callback`;

    const prep = this.jazzcash.prepareHostedCheckout({
      amountPkr: Number(q.totalAmount),
      txnRefNo,
      billReference: pending.id,
      description: `VYBE order (${dto.items.length} item${dto.items.length === 1 ? '' : 's'})`,
      returnUrl,
      txnType: 'PAY',
      customerEmail: user.email ?? null,
      customerMobile: user.phone ?? null,
    });

    return { pendingId: pending.id, ...prep };
  }

  async completeJazzCashPayment(txnRefNo: string, callbackBody: Record<string, any>) {
    const pending = await this.prisma.pendingPayment.findFirst({
      where: { provider: 'JAZZCASH' as any, providerRef: txnRefNo, status: 'PENDING' },
    });
    if (!pending) throw new BadRequestException('Invalid or expired payment session');
    if (new Date() > pending.expiresAt) {
      await this.prisma.pendingPayment.update({ where: { id: pending.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Payment session expired');
    }

    const verify = this.jazzcash.verifyCallback(callbackBody);
    if (!verify.ok) throw new BadRequestException(verify.reason ?? 'JazzCash verification failed');

    const responseCode = String(callbackBody.pp_ResponseCode ?? callbackBody.pp_responsecode ?? '');
    const isPaid = responseCode === '000' || responseCode.toUpperCase() === 'T00';
    if (!isPaid) {
      await this.prisma.pendingPayment.update({
        where: { id: pending.id },
        data: { providerPayloadJson: JSON.stringify(callbackBody), status: 'EXPIRED' },
      });
      throw new BadRequestException(`JazzCash payment failed (${responseCode || 'unknown'})`);
    }

    const items = JSON.parse(pending.itemsJson) as { productId: string; variantId?: string; quantity: number; price?: number }[];
    const dto: CreateOrderDto = {
      storeId: pending.storeId,
      addressId: pending.addressId,
      items,
      paymentMethod: 'CARD',
      // we don't rely on client-supplied refs; order is created server-side here
    } as any;

    const order = await this.create(pending.customerId, dto);

    await this.prisma.pendingPayment.update({
      where: { id: pending.id },
      data: {
        status: 'COMPLETED',
        providerPayloadJson: JSON.stringify(callbackBody),
        orderId: order.id,
      },
    });

    return order;
  }

  async prepareEasypaisa(customerId: string, dto: PrepareXPayDto) {
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
    if (!this.easypaisa.isConfigured()) {
      throw new BadRequestException('Easypaisa is not configured');
    }

    const { subtotal: subtotalAmount } = await this.assertItemsAndSubtotal(this.prisma, dto.storeId, dto.items, {
      checkStock: true,
    });
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal: subtotalAmount,
      paymentMethod: 'CARD',
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      select: { email: true, phone: true },
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const orderRefNum = this.easypaisa.generateOrderRefNum();
    const pending = await this.prisma.pendingPayment.create({
      data: {
        customerId,
        storeId: dto.storeId,
        addressId: dto.addressId,
        itemsJson: JSON.stringify(dto.items),
        amountPkr: q.totalAmount,
        status: 'PENDING',
        expiresAt,
        provider: 'EASYPAISA',
        providerRef: orderRefNum,
      },
    });

    const backendUrl = this.config.get<string>('BACKEND_URL') ?? 'http://localhost:4000';
    const postBackUrl = `${backendUrl}/api/v1/orders/easypaisa-postback?orderRefNum=${encodeURIComponent(orderRefNum)}`;

    const prep = this.easypaisa.preparePostMethod({
      amountPkr: Number(q.totalAmount),
      orderRefNum,
      postBackUrl,
      emailAddr: user.email ?? null,
      mobileNum: user.phone ?? null,
      autoRedirect: '0',
    });

    return { pendingId: pending.id, ...prep };
  }

  async completeEasypaisaPayment(orderRefNum: string, resultQuery: Record<string, any>) {
    const pending = await this.prisma.pendingPayment.findFirst({
      where: { provider: 'EASYPAISA', providerRef: orderRefNum, status: 'PENDING' },
    });
    if (!pending) throw new BadRequestException('Invalid or expired payment session');
    if (new Date() > pending.expiresAt) {
      await this.prisma.pendingPayment.update({ where: { id: pending.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Payment session expired');
    }

    const status = String(resultQuery.status ?? '').toLowerCase();
    const desc = String(resultQuery.desc ?? '');
    const isPaid = status === 'success' || status === 'paid';
    if (!isPaid) {
      await this.prisma.pendingPayment.update({
        where: { id: pending.id },
        data: { providerPayloadJson: JSON.stringify(resultQuery), status: 'EXPIRED' },
      });
      throw new BadRequestException(`Easypaisa payment failed (${desc || status || 'unknown'})`);
    }

    const items = JSON.parse(pending.itemsJson) as { productId: string; variantId?: string; quantity: number; price?: number }[];
    const dto: CreateOrderDto = {
      storeId: pending.storeId,
      addressId: pending.addressId,
      items,
      paymentMethod: 'CARD',
    } as any;

    const order = await this.create(pending.customerId, dto);

    await this.prisma.pendingPayment.update({
      where: { id: pending.id },
      data: { status: 'COMPLETED', providerPayloadJson: JSON.stringify(resultQuery), orderId: order.id },
    });

    return order;
  }

  /**
   * Validates line items against catalog prices (anti-tamper) and optionally stock.
   */
  private async assertItemsAndSubtotal(
    db: Pick<PrismaService, 'product' | 'productVariant'>,
    storeId: string,
    items: { productId: string; variantId?: string; quantity: number; price?: number }[],
    options: { checkStock: boolean },
  ): Promise<{ subtotal: number; productById: Map<string, Product>; variantById: Map<string, ProductVariant> }> {
    const products = await db.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, storeId },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))] as string[];
    const variants = variantIds.length
      ? await db.productVariant.findMany({ where: { id: { in: variantIds } } })
      : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));
    let subtotal = 0;
    for (const item of items) {
      const prod = productById.get(item.productId);
      if (!prod) throw new BadRequestException(`Product ${item.productId} not found`);
      if (prod.isDraft) {
        throw new BadRequestException(`Product "${prod.name}" is not available for sale yet`);
      }
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
    return { subtotal, productById, variantById };
  }

  async quote(customerId: string, dto: OrderQuoteDto) {
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
    const { subtotal } = await this.assertItemsAndSubtotal(this.prisma, dto.storeId, dto.items, {
      checkStock: false,
    });
    const useCard = !PAYMENTS_COD_ONLY && dto.paymentMethod === 'CARD';
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal,
      paymentMethod: useCard ? 'CARD' : 'COD',
    });
    return {
      subtotal: q.subtotal.toFixed(2),
      deliveryDistanceKm: q.deliveryDistanceKm.toFixed(4),
      deliveryFee: q.deliveryFee.toFixed(2),
      serviceFee: q.serviceFee.toFixed(2),
      baseBeforeSurcharge: q.baseBeforeSurcharge.toFixed(2),
      gstAmount: q.gstAmount.toFixed(2),
      cardProcessingAmount: q.cardProcessingAmount.toFixed(2),
      totalAmount: q.totalAmount.toFixed(2),
      commissionPercent: q.commissionPercent.toFixed(2),
      commissionAmount: q.commissionAmount.toFixed(2),
      storeAmount: q.storeAmount.toFixed(2),
      categorySlugUsed: q.categorySlugUsed,
      codTaxPercent: q.codTaxPercent.toFixed(2),
      serviceFeeMode: q.serviceFeeMode,
      serviceFeePercent: q.serviceFeePercent.toFixed(2),
    };
  }

  async createPaymentIntent(customerId: string, dto: CreatePaymentIntentDto) {
    if (PAYMENTS_COD_ONLY) {
      throw new BadRequestException('Only cash on delivery is available at the moment.');
    }
    if (this.xpay.isConfigured()) {
      throw new BadRequestException('Use prepare-xpay for card payments with XPay');
    }
    if (!this.stripe.isConfigured()) {
      throw new BadRequestException('Card payments are not available');
    }
    const pm = await this.prisma.savedPaymentMethod.findFirst({
      where: { id: dto.paymentMethodId, userId: customerId },
    });
    if (!pm || !pm.providerId.startsWith('pm_')) {
      throw new ForbiddenException('Valid Stripe payment method required');
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      select: { stripeCustomerId: true },
    });
    if (!user.stripeCustomerId) {
      throw new BadRequestException('Payment method not set up for charging');
    }
    const amountPaisas = Math.round(dto.amount * 100);
    const { clientSecret, id } = await this.stripe.createPaymentIntent(
      amountPaisas,
      user.stripeCustomerId,
      pm.providerId,
      { userId: customerId }
    );
    return { clientSecret, paymentIntentId: id };
  }

  async prepareXPay(customerId: string, dto: PrepareXPayDto) {
    if (PAYMENTS_COD_ONLY) {
      throw new BadRequestException('Only cash on delivery is available at the moment.');
    }
    if (!this.xpay.isConfigured()) {
      throw new BadRequestException('XPay is not configured');
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

    const { subtotal: subtotalAmount } = await this.assertItemsAndSubtotal(this.prisma, dto.storeId, dto.items, {
      checkStock: true,
    });
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal: subtotalAmount,
      paymentMethod: 'CARD',
    });
    const totalAmount = Number(q.totalAmount);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      select: { name: true, email: true, phone: true },
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    const pending = await this.prisma.pendingPayment.create({
      data: {
        customerId,
        storeId: dto.storeId,
        addressId: dto.addressId,
        itemsJson: JSON.stringify(dto.items),
        amountPkr: q.totalAmount,
        status: 'PENDING',
        expiresAt,
      },
    });

    const backendUrl = this.config.get<string>('BACKEND_URL') ?? 'http://localhost:4000';
    const callbackUrl = `${backendUrl}/api/v1/orders/xpay-callback?pendingId=${pending.id}`;
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const cancelUrl = `${frontendUrl}/cart/checkout`;

    const result = await this.xpay.createPaymentIntent({
      amountPkr: totalAmount,
      customer: { name: user.name, email: user.email, phone: user.phone },
      orderReference: pending.id,
      callbackUrl,
      cancelUrl,
      shipping: {
        address1: address.fullAddress,
        city: address.city,
        country: 'Pakistan',
        zip: '',
      },
    });

    if (!result.success) {
      await this.prisma.pendingPayment.update({
        where: { id: pending.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException(result.error ?? 'Failed to create payment');
    }

    return {
      pendingId: pending.id,
      redirectUrl: result.redirectUrl,
      clientSecret: result.clientSecret,
      encryptionKey: result.encryptionKey,
      intentId: result.intentId,
    };
  }

  async completeXPayPayment(pendingId: string, xpayIntentId: string) {
    const pending = await this.prisma.pendingPayment.findFirst({
      where: { id: pendingId, status: 'PENDING' },
    });
    if (!pending) throw new BadRequestException('Invalid or expired payment session');

    if (new Date() > pending.expiresAt) {
      await this.prisma.pendingPayment.update({
        where: { id: pendingId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Payment session expired');
    }

    const verification = await this.xpay.verifyPayment(xpayIntentId);
    const isPaid = verification && ['succeeded', 'paid', 'completed', 'captured'].includes(String(verification.status).toLowerCase());

    if (!isPaid) {
      throw new BadRequestException('Payment not confirmed. Please try again.');
    }

    const items = JSON.parse(pending.itemsJson) as { productId: string; quantity: number; price: number }[];
    const dto: CreateOrderDto = {
      storeId: pending.storeId,
      addressId: pending.addressId,
      items,
      paymentMethod: 'CARD',
      xpayIntentId,
    };

    const order = await this.create(pending.customerId, dto);

    await this.prisma.pendingPayment.update({
      where: { id: pendingId },
      data: { status: 'COMPLETED', xpayIntentId },
    });

    return order;
  }

  isCardPaymentAvailable(): { stripe: boolean; xpay: boolean } {
    if (PAYMENTS_COD_ONLY) {
      return { stripe: false, xpay: false };
    }
    return {
      stripe: this.stripe.isConfigured(),
      xpay: this.xpay.isConfigured(),
    };
  }

  async create(customerId: string, dto: CreateOrderDto) {
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

    if (PAYMENTS_COD_ONLY) {
      if (
        dto.paymentMethod === 'CARD' ||
        dto.paymentIntentId ||
        dto.xpayIntentId ||
        dto.paymentMethodId
      ) {
        throw new BadRequestException('Only cash on delivery is available at the moment.');
      }
    }

    const useCard = PAYMENTS_COD_ONLY ? false : dto.paymentMethod === 'CARD';

    const order = await this.prisma.$transaction(async (tx) => {
      const { subtotal: subtotalAmount, productById, variantById } = await this.assertItemsAndSubtotal(tx, dto.storeId, dto.items, {
        checkStock: true,
      });
      const subtotalDecimal = new Decimal(subtotalAmount);

      const q = await this.pricing.buildQuote({
        storeId: dto.storeId,
        addressLat: Number(address.latitude),
        addressLng: Number(address.longitude),
        storeLat: store.latitude != null ? Number(store.latitude) : null,
        storeLng: store.longitude != null ? Number(store.longitude) : null,
        subtotal: subtotalAmount,
        paymentMethod: useCard ? 'CARD' : 'COD',
      });

      for (const item of dto.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      await tx.product.updateMany({
        where: { stock: { lte: 0 } },
        data: { isOutOfStock: true },
      });

      if (useCard) {
        if (dto.xpayIntentId && this.xpay.isConfigured()) {
          const verification = await this.xpay.verifyPayment(dto.xpayIntentId);
          const isPaid = verification && ['succeeded', 'paid', 'completed', 'captured'].includes(String(verification.status).toLowerCase());
          if (!isPaid) throw new BadRequestException('XPay payment not confirmed. Please try again.');
        } else if (dto.paymentIntentId && this.stripe.isConfigured()) {
          const pi = await this.stripe.retrievePaymentIntent(dto.paymentIntentId);
          if (!pi || pi.status !== 'succeeded') {
            throw new BadRequestException('Payment not confirmed. Please try again.');
          }
        } else if (dto.paymentMethodId) {
          const pm = await tx.savedPaymentMethod.findFirst({
            where: { id: dto.paymentMethodId, userId: customerId },
          });
          if (!pm) throw new ForbiddenException('Payment method not found or does not belong to you');
        } else {
          throw new BadRequestException('paymentMethodId, paymentIntentId, or xpayIntentId is required when paymentMethod is CARD');
        }
      }

      const slaDeadlineAt = this.pricing.slaDeadlineFromNow();
      const o = await tx.order.create({
        data: {
          customerId,
          storeId: dto.storeId,
          addressId: dto.addressId,
          subtotalAmount: subtotalDecimal,
          deliveryFee: q.deliveryFee,
          serviceFee: q.serviceFee,
          gstAmount: q.gstAmount,
          cardProcessingAmount: q.cardProcessingAmount,
          totalAmount: q.totalAmount,
          commissionAmount: q.commissionAmount,
          commissionPercentSnapshot: q.commissionPercent,
          deliveryDistanceKm: q.deliveryDistanceKm,
          slaDeadlineAt,
          paymentMethod: useCard ? 'CARD' : 'COD',
          paymentStatus: useCard ? 'PAID' : 'PENDING',
          orderStatus: OrderStatus.PENDING,
          notes: dto.notes,
          items: {
            create: dto.items.map((i) => {
              const prod = productById.get(i.productId)!;
              const variant = i.variantId
                ? variantById.get(i.variantId) ?? null
                : null;
              return {
                productId: i.productId,
                variantId: variant?.id ?? null,
                variantNameSnapshot: variant?.name ?? null,
                quantity: new Decimal(i.quantity),
                price: variant ? variant.price : prod.price,
              };
            }),
          },
        },
        include: {
          address: true,
          store: true,
          customer: { select: { name: true, phone: true } },
          items: { include: { product: true } },
        },
      });

      await tx.orderStatusHistory.create({
        data: { orderId: o.id, status: OrderStatus.PENDING, changedByUserId: customerId },
      });

      await tx.storeEarning.create({
        data: {
          storeId: dto.storeId,
          orderId: o.id,
          storeAmount: q.storeAmount,
          commissionAmount: q.commissionAmount,
        },
      });

      return o;
    });

    this.ordersGateway.emitOrderCreated({
      id: order.id,
      storeId: order.storeId,
      customerId: order.customerId,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt.toISOString(),
      totalAmount: order.totalAmount.toString(),
      subtotalAmount: order.subtotalAmount.toString(),
      deliveryFee: order.deliveryFee.toString(),
      serviceFee: order.serviceFee.toString(),
      gstAmount: order.gstAmount.toString(),
      cardProcessingAmount: order.cardProcessingAmount.toString(),
      slaDeadlineAt: order.slaDeadlineAt?.toISOString() ?? null,
      customer: {
        name: order.customer?.name ?? '',
        phone: order.customer?.phone ?? '',
      },
    });

    return order;
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

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        store: true,
        address: true,
        customer: { select: { name: true, phone: true } },
        rider: { select: { name: true, phone: true } },
        items: { include: { product: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async updateStatus(
    orderId: string,
    userId: string,
    role: Role,
    dto: UpdateOrderStatusDto
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ForbiddenException('Order not found');

    if (role === Role.CUSTOMER && order.customerId !== userId) throw new ForbiddenException('Order not found');
    if (role === Role.STORE_OWNER) {
      const store = await this.stores.getStoreForOwner(userId);
      if (!store || order.storeId !== store.id) throw new ForbiddenException('Order not found');
    }

    const toStatus = dto.status as OrderStatus;
    const isRiderSelfClaim =
      role === Role.RIDER &&
      order.orderStatus === OrderStatus.READY_FOR_PICKUP &&
      order.riderId == null &&
      toStatus === OrderStatus.RIDER_ASSIGNED;

    if (role === Role.RIDER && order.riderId !== userId && !isRiderSelfClaim) {
      throw new ForbiddenException('Order not found');
    }

    if (
      order.orderStatus === OrderStatus.READY_FOR_PICKUP &&
      toStatus === OrderStatus.RIDER_ACCEPTED &&
      order.riderId !== userId
    ) {
      throw new BadRequestException('Only the assigned captain can accept this order');
    }

    if (!canTransition(order.orderStatus, toStatus, role)) {
      throw new BadRequestException(
        `Cannot change status from ${order.orderStatus} to ${toStatus}`
      );
    }

    if (isRiderSelfClaim) {
      await this.riders.assertRiderCanSelfClaimPickup(userId, orderId);
      const rider = await this.prisma.user.findFirst({
        where: { id: userId, role: Role.RIDER, isActive: true },
      });
      if (!rider) throw new BadRequestException('Rider account inactive');
      const busy = await this.prisma.order.count({
        where: {
          riderId: userId,
          orderStatus: {
            in: [
              OrderStatus.READY_FOR_PICKUP,
              OrderStatus.RIDER_ASSIGNED,
              OrderStatus.RIDER_ACCEPTED,
              OrderStatus.PICKED_UP,
            ],
          },
        },
      });
      if (busy > 0) {
        throw new BadRequestException('Complete or release your current order before accepting another');
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const res = await tx.order.updateMany({
          where: {
            id: orderId,
            orderStatus: OrderStatus.READY_FOR_PICKUP,
            riderId: null,
          },
          data: {
            riderId: userId,
            orderStatus: OrderStatus.RIDER_ASSIGNED,
            riderSelfAssigned: true,
          },
        });
        if (res.count === 0) {
          throw new BadRequestException('Order is no longer available');
        }
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.RIDER_ASSIGNED,
            changedByUserId: userId,
          },
        });
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: {
            store: true,
            address: true,
            customer: { select: { name: true, phone: true } },
            rider: { select: { name: true, phone: true } },
            items: { include: { product: true } },
          },
        });
      });

      if (updated.riderId) {
        this.ordersGateway.emitRiderAssigned(updated.riderId, updated.id);
      }
      // Notification: rider claimed a pickup (assignment)
      if (updated.riderId) {
        await this.notifications.create({
          userId: updated.riderId,
          type: 'ORDER_ASSIGNED',
          title: `New pickup assigned (#${(updated as any).orderNumber ?? updated.id.slice(-8)})`,
          body: 'You have a new pickup. Open the app to view details.',
          data: { orderId: updated.id },
        });
      }
      this.ordersGateway.emitRiderSelfClaimed(updated.id, userId);
      this.ordersGateway.emitOrderUpdated(
        {
          orderId: updated.id,
          orderStatus: updated.orderStatus,
          storeId: updated.storeId,
          customerId: updated.customerId,
          riderId: updated.riderId,
        },
        order.riderId,
      );
      this.ordersGateway.emitPickupPoolUpdated();
      return updated;
    }

    if (toStatus === 'RIDER_ASSIGNED' && !dto.riderId) {
      throw new BadRequestException('riderId is required when assigning rider');
    }

    const updateData: {
      orderStatus: OrderStatus;
      riderId?: string | null;
      riderSelfAssigned?: boolean;
      cancellationReason?: import('@prisma/client').CancellationReason;
      cancelledByRole?: Role;
    } = { orderStatus: toStatus };

    if (toStatus === 'RIDER_ASSIGNED' && dto.riderId) {
      await this.riders.assertRiderNotBlockedForNewPickup(dto.riderId);
      const rider = await this.prisma.user.findFirst({
        where: { id: dto.riderId, role: 'RIDER', isActive: true },
      });
      if (!rider) throw new BadRequestException('Rider not found');
      updateData.riderId = dto.riderId;
      updateData.riderSelfAssigned = false;
    }
    if (toStatus === 'READY_FOR_PICKUP' && order.orderStatus === 'RIDER_ASSIGNED') {
      updateData.riderId = null;
      updateData.riderSelfAssigned = false;
    }
    if (toStatus === 'CANCELLED') {
      updateData.cancellationReason = (dto.cancellationReason as import('@prisma/client').CancellationReason) ?? (role === 'CUSTOMER' ? 'CUSTOMER_CANCELLED' : role === 'STORE_OWNER' ? 'STORE_REJECTED' : 'ADMIN_CANCELLED');
      updateData.cancelledByRole = role;
    }
    if (toStatus === 'STORE_REJECTED') {
      updateData.cancellationReason = 'STORE_REJECTED';
      updateData.cancelledByRole = role;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          store: true,
          address: true,
          customer: { select: { name: true, phone: true } },
          rider: { select: { name: true, phone: true } },
          items: { include: { product: true } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: toStatus,
          changedByUserId: userId,
        },
      });

      if (toStatus === 'DELIVERED') {
        const riderEarning = await tx.riderEarning.findUnique({ where: { orderId } });
        if (!riderEarning) {
          const orderForFee = await tx.order.findUnique({ where: { id: orderId }, select: { deliveryFee: true } });
          const fee = orderForFee?.deliveryFee ?? new Decimal(0);
          await tx.riderEarning.create({
            data: {
              riderId: o.riderId!,
              orderId: o.id,
              earningAmount: fee,
            },
          });
        }
        if (o.riderId) {
          await this.riders.applyCodOnDelivered(tx, {
            riderId: o.riderId,
            paymentMethod: o.paymentMethod,
            totalAmount: o.totalAmount,
          });
        }
      }

      return o;
    });

    // Notifications on key status transitions
    if (toStatus === OrderStatus.RIDER_ASSIGNED && updated.riderId) {
      await this.notifications.create({
        userId: updated.riderId,
        type: 'ORDER_ASSIGNED',
        title: `New pickup assigned (#${(updated as any).orderNumber ?? updated.id.slice(-8)})`,
        body: 'You have a new pickup. Open the app to view details.',
        data: { orderId: updated.id },
      });
    }
    if (toStatus === OrderStatus.RIDER_ACCEPTED || toStatus === OrderStatus.PICKED_UP || toStatus === OrderStatus.DELIVERED) {
      await this.notifications.create({
        userId: updated.customerId,
        type: 'ORDER_UPDATED',
        title: `Order update (#${(updated as any).orderNumber ?? updated.id.slice(-8)})`,
        body: `Status: ${toStatus}`,
        data: { orderId: updated.id, status: toStatus },
      });
    }

    if (toStatus === OrderStatus.RIDER_ASSIGNED && updated.riderId) {
      this.ordersGateway.emitRiderAssigned(updated.riderId, updated.id);
    }

    this.ordersGateway.emitOrderUpdated(
      {
        orderId: updated.id,
        orderStatus: updated.orderStatus,
        storeId: updated.storeId,
        customerId: updated.customerId,
        riderId: updated.riderId,
      },
      order.riderId,
    );

    this.ordersGateway.emitPickupPoolUpdated();
    if (toStatus === OrderStatus.DELIVERED && updated.riderId) {
      await this.riders.emitCodWalletSnapshotForRider(updated.riderId);
    }

    return updated;
  }

  getAllowedTransitions(fromStatus: OrderStatus, role: Role) {
    return getAllowedTransitions(fromStatus, role);
  }

  /** Resolves store for owner, bootstrapping a Store row when missing (legacy accounts). */
  async getStoreForOwner(ownerId: string) {
    return this.stores.getStoreForOwner(ownerId);
  }

  async findForUser(userId: string, role: Role) {
    if (role === Role.CUSTOMER) {
      return this.prisma.order.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          store: true,
          address: true,
          items: { include: { product: true } },
        },
      });
    }
    if (role === Role.RIDER) {
      return this.prisma.order.findMany({
        where: { riderId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          store: { select: { id: true, name: true, address: true, latitude: true, longitude: true, phone: true } },
          customer: { select: { name: true, phone: true } },
          address: true,
          items: { include: { product: true } },
        },
      });
    }
    if (role === Role.STORE_OWNER) {
      const store = await this.stores.getStoreForOwner(userId);
      if (!store) return [];
      return this.prisma.order.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, phone: true } },
          address: true,
          items: { include: { product: true } },
        },
      });
    }
    if (role === Role.ADMIN) {
      return this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          store: true,
          customer: { select: { name: true, phone: true } },
          rider: { select: { name: true, phone: true } },
          address: true,
          items: { include: { product: true } },
        },
      });
    }
    return [];
  }

  async getRiders() {
    return this.prisma.user.findMany({
      where: { role: 'RIDER', isActive: true },
      select: { id: true, name: true, phone: true },
    });
  }

  async reassignRider(orderId: string, newRiderId: string, adminId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, riderId: true, orderStatus: true },
    });
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    if (
      order.orderStatus === OrderStatus.DELIVERED ||
      order.orderStatus === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot change rider for a completed or cancelled order');
    }
    if (order.riderId === newRiderId) {
      throw new BadRequestException('Order is already assigned to this rider');
    }

    const rider = await this.prisma.user.findFirst({
      where: { id: newRiderId, role: Role.RIDER, isActive: true },
      select: { id: true },
    });
    if (!rider) {
      throw new BadRequestException('Rider not found or inactive');
    }

    const advanceFromPickupPool = order.orderStatus === OrderStatus.READY_FOR_PICKUP;
    if (advanceFromPickupPool) {
      await this.riders.assertRiderNotBlockedForNewPickup(newRiderId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          riderId: newRiderId,
          riderSelfAssigned: false,
          ...(advanceFromPickupPool ? { orderStatus: OrderStatus.RIDER_ASSIGNED } : {}),
        },
      });
      if (advanceFromPickupPool) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.RIDER_ASSIGNED,
            changedByUserId: adminId,
          },
        });
      }
      const txAny = tx as any;
      await txAny.orderRiderChange.create({
        data: {
          orderId,
          adminId,
          oldRiderId: order.riderId,
          newRiderId,
          reason,
        },
      });
    });

    this.ordersGateway.emitRiderAssigned(newRiderId, orderId);

    const refreshed = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, orderStatus: true, storeId: true, customerId: true, riderId: true },
    });
    this.ordersGateway.emitOrderUpdated(
      {
        orderId: refreshed.id,
        orderStatus: refreshed.orderStatus,
        storeId: refreshed.storeId,
        customerId: refreshed.customerId,
        riderId: refreshed.riderId,
      },
      order.riderId,
    );
    this.ordersGateway.emitPickupPoolUpdated();

    return { success: true };
  }

  async editOrderItem(
    orderId: string,
    itemId: string,
    userId: string,
    role: Role,
    dto: EditOrderItemDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, storeEarning: true },
    });
    if (!order) throw new BadRequestException('Order not found');

    // Only allow edits while order is with store/admin, before rider/delivery
    if (
      order.orderStatus !== OrderStatus.PENDING &&
      order.orderStatus !== OrderStatus.STORE_ACCEPTED
    ) {
      throw new BadRequestException('Items can only be edited while order is pending or preparing');
    }

    if (role === Role.CUSTOMER) {
      throw new ForbiddenException('Customers cannot edit items');
    }
    if (role === Role.STORE_OWNER) {
      const store = await this.stores.getStoreForOwner(userId);
      if (!store || store.id !== order.storeId) {
        throw new ForbiddenException('Order not found');
      }
    }

    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new BadRequestException('Item not found on order');

    const currentQty = Number(item.quantity);
    const price = Number(item.price);

    const remove = dto.remove === true || dto.quantity === 0;
    const newQty = dto.quantity != null ? Number(dto.quantity) : currentQty;

    if (!remove && (Number.isNaN(newQty) || newQty <= 0 || newQty >= currentQty)) {
      throw new BadRequestException('Only reducing quantity is supported');
    }

    const qtyToRemove = remove ? currentQty : currentQty - newQty;
    const amountDelta = qtyToRemove * price; // amount to subtract from subtotal

    if (amountDelta <= 0) {
      throw new BadRequestException('No change in amount');
    }

    const subtotalDecimal = order.subtotalAmount.minus(new Decimal(amountDelta));
    if (subtotalDecimal.lte(0)) {
      throw new BadRequestException('Order must contain at least one item with positive amount');
    }

    const recomputed = await this.pricing.recomputeFromSubtotal(
      subtotalDecimal,
      order.deliveryFee,
      order.serviceFee,
      order.paymentMethod,
      order.commissionPercentSnapshot,
    );

    await this.prisma.$transaction(async (tx) => {
      // Restore stock for removed quantity
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: qtyToRemove } },
      });

      if (remove) {
        await tx.orderItem.delete({ where: { id: itemId } });
      } else {
        await tx.orderItem.update({
          where: { id: itemId },
          data: { quantity: new Decimal(newQty) },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotalAmount: subtotalDecimal,
          gstAmount: recomputed.gstAmount,
          cardProcessingAmount: recomputed.cardProcessingAmount,
          commissionAmount: recomputed.commissionAmount,
          totalAmount: recomputed.totalAmount,
        },
      });

      if (order.storeEarning) {
        await tx.storeEarning.update({
          where: { id: order.storeEarning.id },
          data: {
            storeAmount: recomputed.storeAmount,
            commissionAmount: recomputed.commissionAmount,
          },
        });
      }
    });

    return { success: true };
  }
}
