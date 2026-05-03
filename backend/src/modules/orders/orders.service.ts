import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { XPayService } from '../xpay/xpay.service';
import { JazzCashService } from '../jazzcash/jazzcash.service';
import { EasypaisaService } from '../easypaisa/easypaisa.service';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PendingPaymentProvider,
  Prisma,
  Product,
  ProductVariant,
  Role,
} from '@prisma/client';
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
import { isStoreWithinPostedHours } from '../../common/store/store-hours.util';
import { formatOrderNoForDisplay } from '../../common/format/order-number';
import {
  isCheckoutOtpEnforced,
  freeDeliveryOrderCap,
  isManualMvpEnabled,
  manualMvpAccountDisplay,
  orderStrikeCancelThreshold,
  pkPhoneHeuristicWarning,
  bankManualMvpDisplaySplit,
} from './manual-mvp.util';
import {
  isPosAutoAcceptOrdersEnvEnabled,
  resolvePosAutoAcceptOrdersEnabled,
} from '../../common/pos/pos-workflow.util';
import { assertOrderCartItemsAndTotals } from '../../common/pricing/assert-order-cart-items';
import { customerUnitPriceFromBase } from '../../common/pricing/customer-price-markup.util';

/** Set `false` when Stripe / XPay keys are ready and clients show those options again. */
const PAYMENTS_COD_ONLY = true;
const AUTO_ASSIGN_NEAREST_RIDER = true;

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
    if (PAYMENTS_COD_ONLY) {
      throw new BadRequestException('Only cash on delivery is available at the moment.');
    }
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
    this.assertCustomerCanOrderFromStore(store);
    if (!this.jazzcash.isConfigured()) {
      throw new BadRequestException('JazzCash is not configured');
    }

    const { subtotal: subtotalAmount, subtotalBase: subtotalBaseAmount } = await this.assertItemsAndSubtotal(
      this.prisma,
      dto.storeId,
      dto.items,
      {
        checkStock: true,
      },
    );
    const priorJ = await this.priorPlacedOrderCountForPromos(customerId);
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal: subtotalAmount,
      subtotalBase: subtotalBaseAmount,
      paymentMethod: 'CARD',
      waiveDeliveryFee: priorJ < freeDeliveryOrderCap(),
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

    const order = await this.create(pending.customerId, dto, { allowCardWhenCodOnly: true });

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
    if (PAYMENTS_COD_ONLY) {
      throw new BadRequestException('Only cash on delivery is available at the moment.');
    }
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId: customerId },
    });
    if (!address) throw new ForbiddenException('Address not found');
    const store = await this.prisma.store.findFirst({
      where: { id: dto.storeId, isApproved: true },
    });
    if (!store) throw new ForbiddenException('Store not found');
    this.assertCustomerCanOrderFromStore(store);
    if (!this.easypaisa.isConfigured()) {
      throw new BadRequestException('Easypaisa is not configured');
    }

    const { subtotal: subtotalAmount, subtotalBase: subtotalBaseAmount } = await this.assertItemsAndSubtotal(
      this.prisma,
      dto.storeId,
      dto.items,
      {
        checkStock: true,
      },
    );
    const priorE = await this.priorPlacedOrderCountForPromos(customerId);
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal: subtotalAmount,
      subtotalBase: subtotalBaseAmount,
      paymentMethod: 'CARD',
      waiveDeliveryFee: priorE < freeDeliveryOrderCap(),
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

    const order = await this.create(pending.customerId, dto, { allowCardWhenCodOnly: true });

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
    db: Pick<PrismaService, 'product' | 'productVariant' | 'store'>,
    storeId: string,
    items: { productId: string; variantId?: string; quantity: number; price?: number }[],
    options: { checkStock: boolean },
  ): Promise<{
    subtotal: number;
    subtotalBase: number;
    customerMarkupPercent: number;
    productById: Map<string, Product>;
    variantById: Map<string, ProductVariant>;
  }> {
    return assertOrderCartItemsAndTotals(db, storeId, items, options);
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
    this.assertCustomerCanOrderFromStore(store);
    const { subtotal, subtotalBase } = await this.assertItemsAndSubtotal(this.prisma, dto.storeId, dto.items, {
      checkStock: false,
    });
    const useCard = !PAYMENTS_COD_ONLY && dto.paymentMethod === 'CARD';
    const useManualMvp = isManualMvpEnabled() && dto.paymentMethod === 'MANUAL';
    const prior = await this.priorPlacedOrderCountForPromos(customerId);
    const waiveDelivery = prior < freeDeliveryOrderCap();
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal,
      subtotalBase,
      paymentMethod: useManualMvp ? 'MANUAL' : useCard ? 'CARD' : 'COD',
      waiveDeliveryFee: waiveDelivery,
    });
    return {
      subtotal: q.subtotal.toFixed(2),
      deliveryDistanceKm: q.deliveryDistanceKm.toFixed(4),
      deliveryFee: q.deliveryFee.toFixed(2),
      deliveryFeeGross: q.deliveryFeeGross.toFixed(2),
      deliveryDiscount: q.deliveryDiscount.toFixed(2),
      freeDeliveryApplied: waiveDelivery,
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
    this.assertCustomerCanOrderFromStore(store);

    const { subtotal: subtotalAmount, subtotalBase: subtotalBaseAmount } = await this.assertItemsAndSubtotal(
      this.prisma,
      dto.storeId,
      dto.items,
      {
        checkStock: true,
      },
    );
    const priorX = await this.priorPlacedOrderCountForPromos(customerId);
    const q = await this.pricing.buildQuote({
      storeId: dto.storeId,
      addressLat: Number(address.latitude),
      addressLng: Number(address.longitude),
      storeLat: store.latitude != null ? Number(store.latitude) : null,
      storeLng: store.longitude != null ? Number(store.longitude) : null,
      subtotal: subtotalAmount,
      subtotalBase: subtotalBaseAmount,
      paymentMethod: 'CARD',
      waiveDeliveryFee: priorX < freeDeliveryOrderCap(),
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

    const order = await this.create(pending.customerId, dto, { allowCardWhenCodOnly: true });

    await this.prisma.pendingPayment.update({
      where: { id: pendingId },
      data: { status: 'COMPLETED', xpayIntentId },
    });

    return order;
  }

  isCardPaymentAvailable(): { stripe: boolean; xpay: boolean; manualMvp: boolean } {
    if (PAYMENTS_COD_ONLY) {
      return { stripe: false, xpay: false, manualMvp: isManualMvpEnabled() };
    }
    return {
      stripe: this.stripe.isConfigured(),
      xpay: this.xpay.isConfigured(),
      manualMvp: isManualMvpEnabled(),
    };
  }

  /**
   * **Option A (strict) —** no `Order` / stock / store signal until proof exists; see `create(..., { manualBankProofUrl })`.
   * Option B (order first + pending payment) is not used for manual bank+screenshot. Ref: `POST checkout/manual-bank/confirm`.
   */
  async createManualBankOrderWithProof(
    customerId: string,
    dto: CreateOrderDto,
    paymentScreenshotUrl: string,
  ) {
    if (!isManualMvpEnabled()) {
      throw new BadRequestException('Manual online payment is not available at the moment.');
    }
    if (dto.paymentMethod !== 'MANUAL_TRANSFER' || dto.manualTransferProvider !== 'BANK_MANUAL') {
      throw new BadRequestException('This endpoint only accepts bank transfer (IBAN).');
    }
    if (!paymentScreenshotUrl?.trim()) {
      throw new BadRequestException('Please upload a payment screenshot.');
    }
    if (!manualMvpAccountDisplay('BANK_MANUAL' as PendingPaymentProvider)) {
      throw new BadRequestException(
        'Bank transfer is not configured on the server. Ask the admin to set VYBE_MVP_BANK_* env variables.',
      );
    }
    return this.create(customerId, dto, { manualBankProofUrl: paymentScreenshotUrl });
  }

  async create(
    customerId: string,
    dto: CreateOrderDto,
    options?: { allowCardWhenCodOnly?: boolean; /** MVP: create order only after bank transfer screenshot. */ manualBankProofUrl?: string },
  ) {
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId: customerId },
    });
    if (!address) throw new ForbiddenException('Address not found');
    const store = await this.prisma.store.findFirst({
      where: { id: dto.storeId, isApproved: true },
    });
    if (!store) throw new ForbiddenException('Store not found');
    this.assertCustomerCanOrderFromStore(store);

    const paymentMethod = dto.paymentMethod ?? 'COD';
    const isManualMvp = paymentMethod === 'MANUAL_TRANSFER' && isManualMvpEnabled();
    const isManualWithProof = !!options?.manualBankProofUrl?.trim();
    const isManual = isManualMvp || isManualWithProof;

    if (isManualWithProof) {
      if (dto.paymentMethod !== 'MANUAL_TRANSFER' || dto.manualTransferProvider !== 'BANK_MANUAL') {
        throw new BadRequestException('When uploading payment proof, use bank transfer (IBAN) only.');
      }
    }

    if (isManual) {
      if (!dto.manualTransferProvider) {
        throw new BadRequestException('Select a transfer method or use bank transfer from checkout with proof.');
      }
      const acc = manualMvpAccountDisplay(
        dto.manualTransferProvider as PendingPaymentProvider,
      );
      if (!acc) {
        throw new BadRequestException(
          'This payment method is not configured on the server. Ask the admin to set the merchant account (VYBE_MVP_* env).',
        );
      }
    } else if (paymentMethod === 'MANUAL_TRANSFER' && !isManualMvpEnabled()) {
      throw new BadRequestException('Manual online payment is not available at the moment.');
    }

    if (isManualMvp && !isManualWithProof) {
      throw new BadRequestException(
        'Online transfer orders are placed only after you upload your payment proof on checkout. Use “Submit payment & place order” at the end of the bank transfer step—no order is created before your screenshot is received.',
      );
    }

    await this.assertMvpPreOrderRules(customerId);

    if (PAYMENTS_COD_ONLY && !options?.allowCardWhenCodOnly) {
      if (
        dto.paymentMethod === 'CARD' ||
        dto.paymentIntentId ||
        dto.xpayIntentId ||
        dto.paymentMethodId
      ) {
        throw new BadRequestException('Only cash on delivery is available at the moment.');
      }
    }

    const useCard = dto.paymentMethod === 'CARD' && (!PAYMENTS_COD_ONLY || options?.allowCardWhenCodOnly);
    const useCardLikeQuote = useCard || isManual;

    const slaDeadlineAt = this.pricing.slaDeadlineFromNow();
    // See priorPlacedOrderCountForPromos() JSDoc — snapshot count; not serializable with concurrent carts.
    const priorPlaced = await this.priorPlacedOrderCountForPromos(customerId);
    const waiveDelivery = priorPlaced < freeDeliveryOrderCap();

    const order = await this.prisma.$transaction(
      async (tx) => {
        const { subtotal: subtotalAmount, subtotalBase: subtotalBaseAmount, productById, variantById, customerMarkupPercent } =
          await this.assertItemsAndSubtotal(
          tx,
          dto.storeId,
          dto.items,
          {
            checkStock: true,
          },
        );
        const subtotalDecimal = new Decimal(subtotalAmount);

        const q = await this.pricing.buildQuote({
          storeId: dto.storeId,
          addressLat: Number(address.latitude),
          addressLng: Number(address.longitude),
          storeLat: store.latitude != null ? Number(store.latitude) : null,
          storeLng: store.longitude != null ? Number(store.longitude) : null,
          subtotal: subtotalAmount,
          subtotalBase: subtotalBaseAmount,
          paymentMethod: useCardLikeQuote ? (isManual ? 'MANUAL' : 'CARD') : 'COD',
          waiveDeliveryFee: waiveDelivery,
        });

        // NOTE: Prisma interactive transactions should not run queries in parallel.
        // Also, decrementing N items one-by-one is slower than a single SQL update.
        const qtyByProductId = new Map<string, number>();
        for (const item of dto.items) {
          qtyByProductId.set(item.productId, (qtyByProductId.get(item.productId) ?? 0) + Number(item.quantity));
        }
        const productIds = Array.from(qtyByProductId.keys());
        if (productIds.length > 0) {
          const cases = productIds.map((id) =>
            Prisma.sql`WHEN ${id} THEN ${new Decimal(qtyByProductId.get(id) ?? 0)}`,
          );
          await tx.$executeRaw(
            Prisma.sql`
              UPDATE "Product"
              SET "stock" = "stock" - (CASE "id" ${Prisma.join(cases, ' ')} ELSE 0 END)
              WHERE "store_id" = ${dto.storeId} AND "id" IN (${Prisma.join(productIds)})
            `,
          );
        }
        await tx.product.updateMany({
          where: { storeId: dto.storeId, stock: { lte: 0 } },
          data: { isOutOfStock: true },
        });

        const o = await tx.order.create({
        data: {
          customerId,
          storeId: dto.storeId,
          addressId: dto.addressId,
          subtotalAmount: subtotalDecimal,
          deliveryFee: q.deliveryFee,
          deliveryFeeOriginal: q.deliveryFeeGross,
          deliveryDiscount: q.deliveryDiscount,
          serviceFee: q.serviceFee,
          gstAmount: q.gstAmount,
          cardProcessingAmount: q.cardProcessingAmount,
          totalAmount: q.totalAmount,
          commissionAmount: q.commissionAmount,
          commissionPercentSnapshot: q.commissionPercent,
          deliveryDistanceKm: q.deliveryDistanceKm,
          slaDeadlineAt,
          paymentMethod: isManual
            ? 'MANUAL_TRANSFER'
            : useCard
              ? 'CARD'
              : 'COD',
            // COD: PENDING. CARD: PENDING then PAID. MANUAL with proof: PENDING_VERIFICATION at creation; admin approves → PAID.
            paymentStatus: options?.manualBankProofUrl
              ? PaymentStatus.PENDING_VERIFICATION
              : PaymentStatus.PENDING,
          orderStatus: OrderStatus.PENDING,
          paymentScreenshotUrl: options?.manualBankProofUrl?.trim() ?? null,
          manualTransferProvider: isManual
            ? (dto.manualTransferProvider as PendingPaymentProvider)
            : null,
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
                price: customerUnitPriceFromBase(variant ? variant.price : prod.price, customerMarkupPercent),
                storeBaseUnitPrice: variant ? variant.price : prod.price,
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

        // For CARD / manual MVP, earnings only after payment is verified.
        if (!useCard && !isManual) {
          await tx.storeEarning.create({
            data: {
              storeId: dto.storeId,
              orderId: o.id,
              storeAmount: q.storeAmount,
              commissionAmount: q.commissionAmount,
            },
          });
        }

        return { o, q };
      },
      // Default interactive tx timeout can be 5s on some deployments; give enough headroom for busy DBs.
      { timeout: 20000 },
    );

    // IMPORTANT: do not do slow external calls (Stripe/XPay) inside a DB transaction.
    // We verify AFTER the order exists, to avoid "paid but no order" as much as possible.
    if (useCard) {
      try {
        if (dto.xpayIntentId && this.xpay.isConfigured()) {
          const verification = await this.xpay.verifyPayment(dto.xpayIntentId);
          const isPaid =
            verification && ['succeeded', 'paid', 'completed', 'captured'].includes(String(verification.status).toLowerCase());
          if (!isPaid) throw new BadRequestException('XPay payment not confirmed. Please try again.');
        } else if (dto.paymentIntentId && this.stripe.isConfigured()) {
          const pi = await this.stripe.retrievePaymentIntent(dto.paymentIntentId);
          if (!pi || pi.status !== 'succeeded') {
            throw new BadRequestException('Payment not confirmed. Please try again.');
          }
        } else if (dto.paymentMethodId) {
          const pm = await this.prisma.savedPaymentMethod.findFirst({
            where: { id: dto.paymentMethodId, userId: customerId },
          });
          if (!pm) throw new ForbiddenException('Payment method not found or does not belong to you');
        } else {
          throw new BadRequestException('paymentMethodId, paymentIntentId, or xpayIntentId is required when paymentMethod is CARD');
        }

        // Mark paid + create earnings atomically.
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.o.id },
            data: { paymentStatus: PaymentStatus.PAID },
          });
          await tx.storeEarning.create({
            data: {
              storeId: dto.storeId,
              orderId: order.o.id,
              storeAmount: order.q.storeAmount,
              commissionAmount: order.q.commissionAmount,
            },
          });
        });
      } catch (e) {
        // Compensating action: cancel order and restore stock if payment verification fails.
        const qtyByProductId = new Map<string, number>();
        for (const item of dto.items) {
          qtyByProductId.set(item.productId, (qtyByProductId.get(item.productId) ?? 0) + Number(item.quantity));
        }
        const productIds = Array.from(qtyByProductId.keys());

        await this.prisma.$transaction(async (tx) => {
          if (productIds.length > 0) {
            const cases = productIds.map((id) =>
              Prisma.sql`WHEN ${id} THEN ${new Decimal(qtyByProductId.get(id) ?? 0)}`,
            );
            await tx.$executeRaw(
              Prisma.sql`
                UPDATE "Product"
                SET "stock" = "stock" + (CASE "id" ${Prisma.join(cases, ' ')} ELSE 0 END)
                WHERE "store_id" = ${dto.storeId} AND "id" IN (${Prisma.join(productIds)})
              `,
            );
            await tx.product.updateMany({
              where: { storeId: dto.storeId, stock: { gt: 0 } },
              data: { isOutOfStock: false },
            });
          }
          // If an earning row exists for any reason, remove it on rollback.
          await tx.storeEarning.deleteMany({ where: { orderId: order.o.id } });
          await tx.order.update({
            where: { id: order.o.id },
            data: { orderStatus: OrderStatus.CANCELLED },
          });
        });
        throw e;
      }
    }

    // Emit to store: COD immediately; CARD after API verification; manual MVP only after admin approves.
    if (isManual) {
      // Admin list / payment-audit: show PENDING_VERIFICATION. No store or rider notify until verifyManualMvpPayment.
      this.ordersGateway.emitAdminPipelineUpdated();
    } else if (!useCard) {
      await this.applyPosAutoAcceptIfEnabled(order.o.id);
      const oForEmit = await this.prisma.order.findFirst({
        where: { id: order.o.id },
        include: { customer: { select: { name: true, phone: true } } },
      });
      this.ordersGateway.emitOrderCreated({
        id: oForEmit!.id,
        orderNumber: oForEmit!.orderNumber,
        storeId: oForEmit!.storeId,
        customerId: oForEmit!.customerId,
        orderStatus: oForEmit!.orderStatus,
        createdAt: oForEmit!.createdAt.toISOString(),
        totalAmount: oForEmit!.totalAmount.toString(),
        subtotalAmount: oForEmit!.subtotalAmount.toString(),
        deliveryFee: oForEmit!.deliveryFee.toString(),
        serviceFee: oForEmit!.serviceFee.toString(),
        gstAmount: oForEmit!.gstAmount.toString(),
        cardProcessingAmount: oForEmit!.cardProcessingAmount.toString(),
        slaDeadlineAt: oForEmit!.slaDeadlineAt?.toISOString() ?? null,
        customer: {
          name: oForEmit?.customer?.name ?? '',
          phone: oForEmit?.customer?.phone ?? '',
        },
      });
      // Store owner in-app notification (bell/toasts)
      if (store?.ownerId) {
        await this.notifications.create({
          userId: store.ownerId,
          type: 'ORDER_NEW',
          title: `New order received (${formatOrderNoForDisplay((order.o as { orderNumber?: number }).orderNumber, order.o.id)})`,
          body: `Total: Rs ${Number(order.o.totalAmount).toFixed(0)}`,
          data: { orderId: order.o.id, storeId: order.o.storeId },
        });
      }
      void this.riders.notifyNearbyRidersForNewOrder(order.o.id).catch(() => undefined);
      this.ordersGateway.emitAdminPipelineUpdated();
    } else {
      const paidOrder = await this.prisma.order.findUnique({
        where: { id: order.o.id },
        include: { customer: { select: { name: true, phone: true } } },
      });
      if (paidOrder?.paymentStatus === PaymentStatus.PAID && paidOrder.orderStatus !== OrderStatus.CANCELLED) {
        await this.applyPosAutoAcceptIfEnabled(paidOrder.id);
        const oForEmit = await this.prisma.order.findFirst({
          where: { id: paidOrder.id },
          include: { customer: { select: { name: true, phone: true } } },
        });
        this.ordersGateway.emitOrderCreated({
          id: oForEmit!.id,
          orderNumber: oForEmit!.orderNumber,
          storeId: oForEmit!.storeId,
          customerId: oForEmit!.customerId,
          orderStatus: oForEmit!.orderStatus,
          createdAt: oForEmit!.createdAt.toISOString(),
          totalAmount: oForEmit!.totalAmount.toString(),
          subtotalAmount: oForEmit!.subtotalAmount.toString(),
          deliveryFee: oForEmit!.deliveryFee.toString(),
          serviceFee: oForEmit!.serviceFee.toString(),
          gstAmount: oForEmit!.gstAmount.toString(),
          cardProcessingAmount: oForEmit!.cardProcessingAmount.toString(),
          slaDeadlineAt: oForEmit!.slaDeadlineAt?.toISOString() ?? null,
          customer: {
            name: oForEmit?.customer?.name ?? '',
            phone: oForEmit?.customer?.phone ?? '',
          },
        });
        // Store owner in-app notification (bell/toasts)
        if (store?.ownerId) {
          await this.notifications.create({
            userId: store.ownerId,
            type: 'ORDER_NEW',
            title: `New paid order received (${formatOrderNoForDisplay(paidOrder.orderNumber, paidOrder.id)})`,
            body: `Total: Rs ${Number(paidOrder.totalAmount).toFixed(0)}`,
            data: { orderId: paidOrder.id, storeId: paidOrder.storeId },
          });
        }
        void this.riders.notifyNearbyRidersForNewOrder(paidOrder.id).catch(() => undefined);
        this.ordersGateway.emitAdminPipelineUpdated();
      }
    }

    return order.o;
  }

  /**
   * When `VYBE_POS_AUTO_ACCEPT_ORDERS` is on, skip the store "Accept" step: `PENDING` → `STORE_ACCEPTED`
   * for any order the kitchen is allowed to see (COD, card, or manual after payment verification).
   */
  private async applyPosAutoAcceptIfEnabled(orderId: string): Promise<void> {
    if (!(await resolvePosAutoAcceptOrdersEnabled(this.prisma))) return;
    const row = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!row || row.orderStatus !== OrderStatus.PENDING) return;
    if (row.paymentMethod === 'MANUAL_TRANSFER' && row.paymentStatus !== PaymentStatus.PAID) return;
    const res = await this.prisma.order.updateMany({
      where: { id: orderId, orderStatus: OrderStatus.PENDING },
      data: { orderStatus: OrderStatus.STORE_ACCEPTED },
    });
    if (res.count === 0) return;
    await this.prisma.orderStatusHistory.create({
      data: { orderId, status: OrderStatus.STORE_ACCEPTED, changedByUserId: null },
    });
  }

  private assertCustomerCanOrderFromStore(store: {
    isOpen: boolean;
    openingTime: string | null;
    closingTime: string | null;
    acceptingOrders?: boolean | null;
  }): void {
    if (store.acceptingOrders === false) {
      throw new BadRequestException('This store is not taking new orders right now.');
    }
    const tz = this.config.get<string>('BUSINESS_TIMEZONE', 'Asia/Karachi');
    if (!isStoreWithinPostedHours(store, { timeZone: tz })) {
      throw new BadRequestException('Store is closed. Please try again during business hours.');
    }
  }

  /**
   * Prior orders that still “count” for promos (not customer/store-cancelled or rejected at checkout).
   * Next order index = this + 1 (1st, 2nd, …) for up to N free-delivery promos.
   *
   * **Race (acceptable for typical traffic):** this count is read *before* the new order is inserted.
   * Two concurrent checkouts can both see the same `prior` and both get the same waive/COD gating; only
   * serializable isolation (or a locked counter) would be strict. To harden later, re-check inside the
   * create-order transaction or use `Serializable` (Postgres) with retries on conflict.
   */
  private priorPlacedOrderCountForPromos(customerId: string) {
    return this.prisma.order.count({
      where: {
        customerId,
        orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.STORE_REJECTED] },
      },
    });
  }

  private async assertMvpPreOrderRules(customerId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        checkoutOtpVerifiedUntil: true,
        isOrderingBlocked: true,
        role: true,
      },
    });
    if (!u) throw new ForbiddenException();
    if (u.role !== Role.CUSTOMER) return;
    if (u.isOrderingBlocked) {
      throw new BadRequestException('Your account cannot place new orders. Contact support.');
    }
    if (isCheckoutOtpEnforced()) {
      if (!u.checkoutOtpVerifiedUntil || u.checkoutOtpVerifiedUntil.getTime() < Date.now()) {
        throw new BadRequestException(
          'Please verify the OTP sent to your phone before checking out. Use “Verify phone” on the payment step.',
        );
      }
    }
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

    if (role === Role.STORE_OWNER && toStatus === OrderStatus.STORE_ACCEPTED) {
      if (
        order.paymentMethod === 'MANUAL_TRANSFER' &&
        order.paymentStatus !== PaymentStatus.PAID
      ) {
        throw new BadRequestException(
          'This order is not visible to the store until the payment is verified by the team.',
        );
      }
    }

    if (toStatus === OrderStatus.PICKED_UP && role === Role.RIDER && !order.riderArrivedAt) {
      throw new BadRequestException('Mark “Arrived” at the restaurant before pickup.');
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
              OrderStatus.PENDING,
              OrderStatus.STORE_ACCEPTED,
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
          title: `New pickup assigned (${formatOrderNoForDisplay(updated.orderNumber, updated.id)})`,
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
      this.ordersGateway.emitAdminPipelineUpdated();
      return updated;
    }

    if (toStatus === 'RIDER_ASSIGNED' && !dto.riderId) {
      throw new BadRequestException('riderId is required when assigning rider');
    }

    const updateData: {
      orderStatus: OrderStatus;
      riderId?: string | null;
      riderSelfAssigned?: boolean;
      riderArrivedAt?: Date | null;
      cancellationReason?: import('@prisma/client').CancellationReason;
      cancelledByRole?: Role;
    } = { orderStatus: toStatus };

    // Auto-assign nearest rider when order enters pickup pool (optional feature).
    // This runs only when store/admin moves to READY_FOR_PICKUP and no rider is already assigned.
    if (
      AUTO_ASSIGN_NEAREST_RIDER &&
      toStatus === OrderStatus.READY_FOR_PICKUP &&
      !order.riderId
    ) {
      const nearby = await this.riders.findNearbyRidersForPickup(orderId);
      const activeStatuses: OrderStatus[] = [
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.RIDER_ASSIGNED,
        OrderStatus.RIDER_ACCEPTED,
        OrderStatus.PICKED_UP,
      ];
      for (const cand of nearby.slice(0, 10)) {
        // Skip riders who are already busy with an active delivery.
        const busy = await this.prisma.order.count({
          where: { riderId: cand.riderId, orderStatus: { in: activeStatuses } },
        });
        if (busy > 0) continue;
        updateData.orderStatus = OrderStatus.RIDER_ASSIGNED;
        updateData.riderId = cand.riderId;
        updateData.riderSelfAssigned = false;
        break;
      }
    }

    if (toStatus === 'RIDER_ASSIGNED' && dto.riderId) {
      await this.riders.assertRiderNotBlockedForNewPickup(dto.riderId);
      const rider = await this.prisma.user.findFirst({
        where: { id: dto.riderId, role: 'RIDER', isActive: true },
      });
      if (!rider) throw new BadRequestException('Rider not found');
      updateData.riderId = dto.riderId;
      updateData.riderSelfAssigned = false;
      if (order.riderId !== dto.riderId) {
        updateData.riderArrivedAt = null;
      }
    }
    if (toStatus === 'READY_FOR_PICKUP' && order.orderStatus === 'RIDER_ASSIGNED') {
      updateData.riderId = null;
      updateData.riderSelfAssigned = false;
      updateData.riderArrivedAt = null;
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

    if (
      toStatus === OrderStatus.CANCELLED &&
      order.paymentMethod === 'MANUAL_TRANSFER' &&
      order.paymentStatus === PaymentStatus.PENDING
    ) {
      await this.prisma.$transaction(async (tx) => {
        await this.restoreStockForOrderInTx(tx, orderId, order.storeId);
      });
    }

    if (
      toStatus === OrderStatus.CANCELLED &&
      role === Role.CUSTOMER &&
      order.orderStatus === OrderStatus.PENDING
    ) {
      const th = orderStrikeCancelThreshold();
      if (th != null) {
        const n = await this.prisma.user.update({
          where: { id: userId },
          data: { orderStrikeCount: { increment: 1 } },
          select: { orderStrikeCount: true },
        });
        if (n.orderStrikeCount >= th) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { isOrderingBlocked: true },
          });
        }
      }
    }

    // Notifications on key status transitions
    if (updated.orderStatus === OrderStatus.RIDER_ASSIGNED && updated.riderId) {
      await this.notifications.create({
        userId: updated.riderId,
        type: 'ORDER_ASSIGNED',
        title: `New pickup assigned (${formatOrderNoForDisplay(updated.orderNumber, updated.id)})`,
        body: 'You have a new pickup. Open the app to view details.',
        data: { orderId: updated.id },
      });
    }
    if (toStatus === OrderStatus.RIDER_ACCEPTED || toStatus === OrderStatus.PICKED_UP || toStatus === OrderStatus.DELIVERED) {
      await this.notifications.create({
        userId: updated.customerId,
        type: 'ORDER_UPDATED',
        title: `Order update (${formatOrderNoForDisplay(updated.orderNumber, updated.id)})`,
        body: `Status: ${toStatus}`,
        data: { orderId: updated.id, status: toStatus },
      });
    }

    if (updated.orderStatus === OrderStatus.RIDER_ASSIGNED && updated.riderId) {
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
    if (updated.orderStatus === OrderStatus.READY_FOR_PICKUP && !updated.riderId) {
      // Offer mode (manual pickup): ping nearby online riders so it appears instantly.
      void this.riders.notifyNearbyRidersForPickup(updated.id);
    }
    if (toStatus === OrderStatus.DELIVERED && updated.riderId) {
      await this.riders.emitCodWalletSnapshotForRider(updated.riderId);
    }

    this.ordersGateway.emitAdminPipelineUpdated();

    return updated;
  }

  getAllowedTransitions(fromStatus: OrderStatus, role: Role) {
    return getAllowedTransitions(fromStatus, role);
  }

  /**
   * Skips store actions until manual payment is confirmed (MVP) so the kitchen does not act on fake tabs.
   */
  async getAllowedTransitionsForOrder(
    order: { orderStatus: OrderStatus; paymentMethod: string; paymentStatus: PaymentStatus },
    role: Role,
  ) {
    const base = getAllowedTransitions(order.orderStatus, role);
    if (
      role === Role.STORE_OWNER &&
      order.paymentMethod === 'MANUAL_TRANSFER' &&
      order.paymentStatus !== PaymentStatus.PAID
    ) {
      return base.filter(
        (s) => s !== OrderStatus.STORE_ACCEPTED && s !== OrderStatus.STORE_REJECTED,
      );
    }
    if (
      (await resolvePosAutoAcceptOrdersEnabled(this.prisma)) &&
      role === Role.STORE_OWNER &&
      order.orderStatus === OrderStatus.PENDING
    ) {
      return base.filter(
        (s) => s !== OrderStatus.STORE_ACCEPTED && s !== OrderStatus.STORE_REJECTED,
      );
    }
    return base;
  }

  /** Rider confirms they are at the pickup location (required before marking picked up). */
  async markRiderArrived(orderId: string, riderId: string, role: Role) {
    if (role !== Role.RIDER) throw new ForbiddenException('Riders only');
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ForbiddenException('Order not found');
    if (order.riderId !== riderId) throw new ForbiddenException('Order not found');
    if (order.riderArrivedAt) {
      return this.findById(orderId);
    }
    const canMark =
      order.orderStatus === OrderStatus.RIDER_ACCEPTED ||
      ((order.orderStatus === OrderStatus.PENDING || order.orderStatus === OrderStatus.STORE_ACCEPTED) &&
        order.riderId != null);
    if (!canMark) {
      throw new BadRequestException(
        'Accept the assignment first, then mark arrived when you are at the restaurant.',
      );
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { riderArrivedAt: new Date() },
      include: {
        store: true,
        address: true,
        customer: { select: { name: true, phone: true } },
        rider: { select: { name: true, phone: true } },
        items: { include: { product: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
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
    return updated;
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
        where: {
          storeId: store.id,
          NOT: {
            AND: [
              { paymentMethod: 'MANUAL_TRANSFER' },
              { paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PENDING_VERIFICATION] } },
            ],
          },
        },
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

  /**
   * Admin: compact ops snapshot — “stale” PENDING may mean payment gate or pipeline issue; verify queue
   * is payment proofs awaiting action.
   */
  async getAdminPipelineHealth() {
    const staleAfterMinutes = 10;
    const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000);
    const [stalePendingCount, paymentProofQueueCount] = await Promise.all([
      this.prisma.order.count({
        where: { orderStatus: OrderStatus.PENDING, createdAt: { lt: cutoff } },
      }),
      this.prisma.order.count({
        where: {
          paymentStatus: PaymentStatus.PENDING_VERIFICATION,
          orderStatus: { not: OrderStatus.CANCELLED },
        },
      }),
    ]);
    const posAutoAcceptFromDatabase =
      (await this.prisma.platformCheckoutSettings.findUnique({
        where: { id: 'default' },
        select: { posAutoAcceptOrders: true },
      }))?.posAutoAcceptOrders === true;
    const posAutoAcceptFromEnv = isPosAutoAcceptOrdersEnvEnabled();
    const posAutoAcceptEnabled = posAutoAcceptFromDatabase || posAutoAcceptFromEnv;
    return {
      posAutoAcceptEnabled,
      posAutoAcceptFromDatabase,
      posAutoAcceptFromEnv,
      stalePendingMinutes: staleAfterMinutes,
      stalePendingCount,
      paymentProofQueueCount,
    };
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
          riderArrivedAt: null,
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

    const usesMarkupModel = order.items.some((i) => i.storeBaseUnitPrice != null);
    let subtotalBaseAfter: Decimal | null = null;
    if (usesMarkupModel) {
      let sumBase = new Decimal(0);
      for (const it of order.items) {
        const baseUnit =
          it.storeBaseUnitPrice != null ? new Decimal(it.storeBaseUnitPrice) : new Decimal(it.price);
        if (it.id === itemId) {
          const q = remove ? 0 : newQty;
          if (q > 0) sumBase = sumBase.add(baseUnit.mul(q));
        } else {
          sumBase = sumBase.add(baseUnit.mul(Number(it.quantity)));
        }
      }
      subtotalBaseAfter = sumBase;
    }

    const recomputed = await this.pricing.recomputeFromSubtotal(
      subtotalDecimal,
      order.deliveryFee,
      order.serviceFee,
      order.paymentMethod,
      order.commissionPercentSnapshot,
      subtotalBaseAfter,
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

  private async restoreStockForOrderInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    storeId: string,
  ) {
    const orderItems = await tx.orderItem.findMany({ where: { orderId } });
    if (orderItems.length === 0) return;
    const qtyByProductId = new Map<string, number>();
    for (const it of orderItems) {
      qtyByProductId.set(
        it.productId,
        (qtyByProductId.get(it.productId) ?? 0) + Number(it.quantity),
      );
    }
    const productIds = Array.from(qtyByProductId.keys());
    const cases = productIds.map((id) =>
      Prisma.sql`WHEN ${id} THEN ${new Decimal(qtyByProductId.get(id) ?? 0)}`,
    );
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Product"
        SET "stock" = "stock" + (CASE "id" ${Prisma.join(cases, ' ')} ELSE 0 END)
        WHERE "store_id" = ${storeId} AND "id" IN (${Prisma.join(productIds)})
      `,
    );
    await tx.product.updateMany({
      where: { storeId, stock: { gt: 0 } },
      data: { isOutOfStock: false },
    });
  }

  async getCheckoutEligibility(customerId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        phone: true,
        checkoutOtpVerifiedUntil: true,
        isOrderingBlocked: true,
        orderStrikeCount: true,
        role: true,
      },
    });
    if (!u) throw new ForbiddenException();
    const deliveredCount =
      u.role === Role.CUSTOMER
        ? await this.prisma.order.count({ where: { customerId, orderStatus: OrderStatus.DELIVERED } })
        : 0;
    const priorPlaced =
      u.role === Role.CUSTOMER ? await this.priorPlacedOrderCountForPromos(customerId) : 0;
    const cap = freeDeliveryOrderCap();
    return {
      manualMvpEnabled: isManualMvpEnabled(),
      checkoutOtpRequired: isCheckoutOtpEnforced(),
      deliveredOrderCount: deliveredCount,
      priorPlacedOrderCount: priorPlaced,
      freeDeliveryOrderCap: cap,
      /** Next order gets waived delivery if true (first N “placed” non-rejected/cancelled orders). */
      qualifiesFreeDelivery: u.role === Role.CUSTOMER && priorPlaced < cap,
      canUseCod: true,
      otpSatisfied:
        u.role !== Role.CUSTOMER ||
        !isCheckoutOtpEnforced() ||
        (!!u.checkoutOtpVerifiedUntil && u.checkoutOtpVerifiedUntil.getTime() > Date.now()),
      isBlocked: u.isOrderingBlocked,
      /** Customer strike count (PENDING cancels). Shown when blocked so users know why. */
      orderStrikeCount: u.role === Role.CUSTOMER ? u.orderStrikeCount : null,
      phoneWarning: u.role === Role.CUSTOMER ? pkPhoneHeuristicWarning(u.phone) : null,
      mvpAccountHints: isManualMvpEnabled()
        ? {
            JAZZCASH: manualMvpAccountDisplay('JAZZCASH'),
            EASYPAISA: manualMvpAccountDisplay('EASYPAISA'),
            BANK_MANUAL: manualMvpAccountDisplay('BANK_MANUAL'),
          }
        : null,
      /** Split fields for “Copy” + primary bank UI (IBAN, account, bank name). */
      bankManualDisplay: isManualMvpEnabled() ? bankManualMvpDisplaySplit() : null,
    };
  }

  async attachPaymentScreenshotFromUrl(customerId: string, orderId: string, imageUrl: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
    });
    if (!order) throw new ForbiddenException('Order not found');
    if (order.paymentMethod !== 'MANUAL_TRANSFER') {
      throw new BadRequestException('Payment proof only applies to JazzCash, Easypaisa, or bank transfer orders.');
    }
    if (order.paymentStatus !== PaymentStatus.PENDING || order.orderStatus !== OrderStatus.PENDING) {
      throw new BadRequestException('You can only upload a screenshot while the order is waiting for payment proof.');
    }
    if (order.paymentScreenshotUrl) {
      throw new BadRequestException('A payment screenshot was already submitted.');
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentScreenshotUrl: imageUrl, paymentStatus: PaymentStatus.PENDING_VERIFICATION },
    });
    this.ordersGateway.emitAdminPipelineUpdated();
    return updated;
  }

  async verifyManualMvpPayment(adminId: string, orderId: string, decision: 'approve' | 'reject') {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: { select: { ownerId: true, name: true } }, customer: { select: { name: true, phone: true } } },
    });
    if (!order) throw new BadRequestException('Order not found');
    if (order.paymentMethod !== 'MANUAL_TRANSFER') {
      throw new BadRequestException('This order is not a manual online payment.');
    }
    if (order.paymentStatus !== PaymentStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('This order is not in payment review.');
    }
    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled.');
    }

    const store = order.store;
    if (decision === 'reject') {
      await this.prisma.$transaction(async (tx) => {
        await this.restoreStockForOrderInTx(tx, order.id, order.storeId);
        await tx.order.update({
          where: { id: orderId },
          data: {
            orderStatus: OrderStatus.CANCELLED,
            cancellationReason: 'OTHER',
            cancelledByRole: Role.ADMIN,
          },
        });
        await tx.adminLog.create({
          data: {
            adminId,
            action: 'MANUAL_PAYMENT_REJECT',
            targetId: orderId,
          },
        });
      });
      this.ordersGateway.emitOrderUpdated(
        {
          orderId: order.id,
          orderStatus: OrderStatus.CANCELLED,
          storeId: order.storeId,
          customerId: order.customerId,
          riderId: order.riderId,
        },
        order.riderId,
      );
      this.ordersGateway.emitAdminPipelineUpdated();
      return { success: true, orderStatus: OrderStatus.CANCELLED };
    }

    const storeAmount = new Decimal(order.subtotalAmount).minus(new Decimal(order.commissionAmount));
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.PAID },
      });
      await tx.storeEarning.create({
        data: {
          storeId: order.storeId,
          orderId: order.id,
          storeAmount: storeAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          commissionAmount: order.commissionAmount,
        },
      });
      await tx.adminLog.create({
        data: {
          adminId,
          action: 'MANUAL_PAYMENT_APPROVE',
          targetId: orderId,
        },
      });
    });
    await this.applyPosAutoAcceptIfEnabled(order.id);
    const oAfterAuto = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { customer: { select: { name: true, phone: true } } },
    });
    this.ordersGateway.emitOrderCreated({
      id: oAfterAuto!.id,
      orderNumber: oAfterAuto!.orderNumber,
      storeId: oAfterAuto!.storeId,
      customerId: oAfterAuto!.customerId,
      orderStatus: oAfterAuto!.orderStatus,
      createdAt: oAfterAuto!.createdAt.toISOString(),
      totalAmount: oAfterAuto!.totalAmount.toString(),
      subtotalAmount: oAfterAuto!.subtotalAmount.toString(),
      deliveryFee: oAfterAuto!.deliveryFee.toString(),
      serviceFee: oAfterAuto!.serviceFee.toString(),
      gstAmount: oAfterAuto!.gstAmount.toString(),
      cardProcessingAmount: oAfterAuto!.cardProcessingAmount.toString(),
      slaDeadlineAt: oAfterAuto!.slaDeadlineAt?.toISOString() ?? null,
      customer: { name: oAfterAuto?.customer?.name ?? '', phone: oAfterAuto?.customer?.phone ?? '' },
    });
    if (store?.ownerId) {
      await this.notifications.create({
        userId: store.ownerId,
        type: 'ORDER_NEW',
        title: `New paid order (manual) (${formatOrderNoForDisplay(order.orderNumber, order.id)})`,
        body: `Total: Rs ${Number(order.totalAmount).toFixed(0)}`,
        data: { orderId: order.id, storeId: order.storeId },
      });
    }
    void this.riders.notifyNearbyRidersForNewOrder(order.id).catch(() => undefined);
    this.ordersGateway.emitAdminPipelineUpdated();
    return { success: true, orderStatus: order.orderStatus, paymentStatus: PaymentStatus.PAID };
  }

  /**
   * Permanently remove orders (testing / data cleanup). Restores product stock.
   * Delivered COD orders are blocked — deleting them would desync rider cash balances.
   */
  async adminHardDeleteOrders(adminId: string, orderIds: string[]) {
    const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) throw new BadRequestException('No order IDs provided');
    if (ids.length > 100) throw new BadRequestException('Maximum 100 orders per request');

    const codDelivered = await this.prisma.order.count({
      where: {
        id: { in: ids },
        orderStatus: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.COD,
      },
    });
    if (codDelivered > 0) {
      throw new BadRequestException(
        `${codDelivered} selected order(s) are delivered cash-on-delivery and cannot be purged here (rider COD balances). Deselect those or adjust in the database.`,
      );
    }

    const deleted: string[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        for (const id of ids) {
          const o = await tx.order.findUnique({ where: { id } });
          if (!o) continue;
          await this.restoreStockForOrderInTx(tx, id, o.storeId);
          await tx.riderEarning.deleteMany({ where: { orderId: id } });
          await tx.storeEarning.deleteMany({ where: { orderId: id } });
          await tx.pendingPayment.updateMany({ where: { orderId: id }, data: { orderId: null } });
          await tx.order.delete({ where: { id } });
          deleted.push(id);
        }
        if (deleted.length > 0) {
          await tx.adminLog.create({
            data: {
              adminId,
              action: 'ORDERS_HARD_DELETE',
              targetId: deleted.length <= 5 ? deleted.join(',') : `count:${deleted.length}`,
            },
          });
        }
      },
      { timeout: 120_000 },
    );

    this.ordersGateway.emitAdminPipelineUpdated();
    return { deletedCount: deleted.length, deletedIds: deleted };
  }
}
