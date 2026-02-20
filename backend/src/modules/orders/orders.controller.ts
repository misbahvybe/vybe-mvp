import { Get, Post, Patch, Body, Param, Query, Controller, UseGuards, ForbiddenException, Res } from '@nestjs/common';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PrepareXPayDto } from './dto/prepare-xpay.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Public()
  @Get('xpay-callback')
  async xpayCallback(
    @Query('pendingId') pendingId: string,
    @Query('xIntentId') xIntentId: string,
    @Query('intent_id') intentIdAlt: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const intentId = xIntentId || intentIdAlt;
    if (!pendingId || !intentId) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/cart/checkout?error=missing_params`);
    }
    try {
      const order = await this.orders.completeXPayPayment(pendingId, intentId);
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/order/${order.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/cart/checkout?error=${encodeURIComponent(msg)}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('payment-intent')
  async createPaymentIntent(@CurrentUser() user: User, @Body() dto: CreatePaymentIntentDto) {
    return this.orders.createPaymentIntent(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('prepare-xpay')
  async prepareXPay(@CurrentUser() user: User, @Body() dto: PrepareXPayDto) {
    return this.orders.prepareXPay(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payment-options')
  async getPaymentOptions() {
    return this.orders.isCardPaymentAvailable();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@CurrentUser() user: User) {
    return this.orders.findForUser(user.id, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get('riders/list')
  async getRiders(@CurrentUser() user: User) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.orders.getRiders();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOne(@CurrentUser() user: User, @Param('id') id: string) {
    const order = await this.orders.findById(id);
    if (!order) throw new ForbiddenException('Order not found');
    if (user.role === 'ADMIN') {
      const allowed = this.orders.getAllowedTransitions(order.orderStatus, user.role);
      return { ...order, allowedTransitions: allowed };
    }
    if (user.role === 'CUSTOMER' && order.customerId !== user.id) throw new ForbiddenException('Order not found');
    if (user.role === 'STORE_OWNER') {
      const store = await this.orders.getStoreForOwner(user.id);
      if (!store || order.storeId !== store.id) throw new ForbiddenException('Order not found');
    }
    if (user.role === 'RIDER' && order.riderId !== user.id) throw new ForbiddenException('Order not found');
    const allowed = this.orders.getAllowedTransitions(order.orderStatus, user.role);
    return { ...order, allowedTransitions: allowed };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, user.id, user.role, dto);
  }
}
