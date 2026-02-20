import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { XPayService } from '../xpay/xpay.service';
import { OrderStatus, Role } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PrepareXPayDto } from './dto/prepare-xpay.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { canTransition, getAllowedTransitions } from './order-state-machine';
import { Decimal } from '@prisma/client/runtime/library';

const PLATFORM_COMMISSION_PERCENT = 0.15; // 15% per pitch
const DELIVERY_FEE = 150; // fixed PKR
const SERVICE_FEE = 23.49; // Rs 23.49 per order per pitch

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly xpay: XPayService,
    private readonly config: ConfigService,
  ) {}

  async createPaymentIntent(customerId: string, dto: CreatePaymentIntentDto) {
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

    let subtotalAmount = 0;
    for (const item of dto.items) {
      subtotalAmount += item.quantity * item.price;
    }
    const totalAmount = subtotalAmount + DELIVERY_FEE + SERVICE_FEE;

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
        amountPkr: new Decimal(totalAmount),
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

    const order = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: dto.items.map((i) => i.productId) }, storeId: dto.storeId },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      for (const item of dto.items) {
        const prod = productMap.get(item.productId);
        if (!prod) throw new BadRequestException(`Product ${item.productId} not found`);
        const stock = Number(prod.stock);
        if (prod.isOutOfStock || stock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${prod.name}. Available: ${stock} ${stock === 0 ? '(out of stock)' : ''}`);
        }
      }

      let subtotalAmount = 0;
      for (const item of dto.items) {
        subtotalAmount += item.quantity * item.price;
      }
      const subtotalDecimal = new Decimal(subtotalAmount);
      const commissionAmount = subtotalDecimal.mul(PLATFORM_COMMISSION_PERCENT);
      const storeAmount = subtotalDecimal.minus(commissionAmount);
      const deliveryFeeDecimal = new Decimal(DELIVERY_FEE);
      const serviceFeeDecimal = new Decimal(SERVICE_FEE);
      const totalAmount = subtotalDecimal.add(deliveryFeeDecimal).add(serviceFeeDecimal);

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

      const useCard = dto.paymentMethod === 'CARD';
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

      const o = await tx.order.create({
        data: {
          customerId,
          storeId: dto.storeId,
          addressId: dto.addressId,
          subtotalAmount: subtotalDecimal,
          deliveryFee: deliveryFeeDecimal,
          serviceFee: serviceFeeDecimal,
          totalAmount,
          commissionAmount,
          paymentMethod: useCard ? 'CARD' : 'COD',
          paymentStatus: useCard ? 'PAID' : 'PENDING',
          orderStatus: OrderStatus.PENDING,
          notes: dto.notes,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: new Decimal(i.quantity),
              price: new Decimal(i.price),
            })),
          },
        },
        include: {
          address: true,
          store: true,
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
          storeAmount,
          commissionAmount,
        },
      });

      return o;
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
      const store = await this.getStoreForOwner(userId);
      if (!store || order.storeId !== store.id) throw new ForbiddenException('Order not found');
    }
    if (role === Role.RIDER && order.riderId !== userId) throw new ForbiddenException('Order not found');

    const toStatus = dto.status as OrderStatus;
    if (!canTransition(order.orderStatus, toStatus, role)) {
      throw new BadRequestException(
        `Cannot change status from ${order.orderStatus} to ${toStatus}`
      );
    }

    if (toStatus === 'RIDER_ASSIGNED' && !dto.riderId) {
      throw new BadRequestException('riderId is required when assigning rider');
    }

    const updateData: {
      orderStatus: OrderStatus;
      riderId?: string | null;
      cancellationReason?: import('@prisma/client').CancellationReason;
      cancelledByRole?: Role;
    } = { orderStatus: toStatus };

    if (toStatus === 'RIDER_ASSIGNED' && dto.riderId) {
      const rider = await this.prisma.user.findFirst({
        where: { id: dto.riderId, role: 'RIDER', isActive: true },
      });
      if (!rider) throw new BadRequestException('Rider not found');
      updateData.riderId = dto.riderId;
    }
    if (toStatus === 'READY_FOR_PICKUP' && order.orderStatus === 'RIDER_ASSIGNED') {
      updateData.riderId = null;
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
          const fee = orderForFee?.deliveryFee ?? new Decimal(DELIVERY_FEE);
          await tx.riderEarning.create({
            data: {
              riderId: o.riderId!,
              orderId: o.id,
              earningAmount: fee,
            },
          });
        }
      }

      return o;
    });

    return updated;
  }

  getAllowedTransitions(fromStatus: OrderStatus, role: Role) {
    return getAllowedTransitions(fromStatus, role);
  }

  async getStoreForOwner(ownerId: string) {
    return this.prisma.store.findFirst({ where: { ownerId } });
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
      const store = await this.prisma.store.findFirst({
        where: { ownerId: userId },
      });
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
}
