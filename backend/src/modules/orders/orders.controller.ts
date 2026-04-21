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
import { EditOrderItemDto } from './dto/edit-order-item.dto';
import { OrderQuoteDto } from './dto/order-quote.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Public()
  @Get('xpay-callback')
  async xpayCallback(
    @Query('pendingId') pendingId: string,
    @Query('xIntentId') xIntentId: string,
    @Query('intent_id') intentIdAlt: string,
    @Query('status') _status: string,
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

  @Public()
  @Post('jazzcash-callback')
  async jazzcashCallback(@Body() body: any, @Res() res: Response) {
    const txnRefNo = String(body?.pp_TxnRefNo ?? '');
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    if (!txnRefNo) {
      return res.redirect(`${frontendUrl}/cart/checkout?error=missing_params`);
    }
    try {
      const order = await this.orders.completeJazzCashPayment(txnRefNo, body ?? {});
      return res.redirect(`${frontendUrl}/order/${order.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      return res.redirect(`${frontendUrl}/cart/checkout?error=${encodeURIComponent(msg)}`);
    }
  }

  @Public()
  @Get('easypaisa-postback')
  async easypaisaPostback(@Query('auth_token') authToken: string, @Query('orderRefNum') orderRefNum: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
    if (!authToken || !orderRefNum) {
      return res.redirect(`${frontendUrl}/cart/checkout?error=missing_params`);
    }

    const confirmUrl = `${process.env.EASYPAISA_BASE_URL ?? 'https://easypaystg.easypaisa.com.pk'}/easypay/Confirm.jsf`;
    const resultUrl = `${backendUrl}/api/v1/orders/easypaisa-result?orderRefNum=${encodeURIComponent(orderRefNum)}`;

    // Easypaisa expects a browser POST to Confirm.jsf with auth_token + postBackURL.
    const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Redirecting…</title></head>
  <body>
    <form id="f" method="post" action="${confirmUrl}">
      <input type="hidden" name="auth_token" value="${String(authToken).replace(/"/g, '&quot;')}" />
      <input type="hidden" name="postBackURL" value="${String(resultUrl).replace(/"/g, '&quot;')}" />
    </form>
    <script>document.getElementById('f').submit();</script>
  </body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Public()
  @Get('easypaisa-result')
  async easypaisaResult(@Query() query: any, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const orderRefNum = String(query?.orderRefNum ?? query?.orderRefNumber ?? '');
    if (!orderRefNum) {
      return res.redirect(`${frontendUrl}/cart/checkout?error=missing_params`);
    }
    try {
      const order = await this.orders.completeEasypaisaPayment(orderRefNum, query ?? {});
      return res.redirect(`${frontendUrl}/order/${order.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
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
  @Post('prepare-jazzcash')
  async prepareJazzCash(@CurrentUser() user: User, @Body() dto: PrepareXPayDto) {
    return this.orders.prepareJazzCash(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('prepare-easypaisa')
  async prepareEasypaisa(@CurrentUser() user: User, @Body() dto: PrepareXPayDto) {
    return this.orders.prepareEasypaisa(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payment-options')
  async getPaymentOptions() {
    return this.orders.isCardPaymentAvailable();
  }

  @UseGuards(JwtAuthGuard)
  @Post('quote')
  async quote(@CurrentUser() user: User, @Body() dto: OrderQuoteDto) {
    return this.orders.quote(user.id, dto);
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
  @Patch(':id/reassign-rider')
  async reassignRider(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { riderId: string; reason?: string },
  ) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.orders.reassignRider(id, body.riderId, user.id, body.reason);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':orderId/items/:itemId')
  async editItem(
    @CurrentUser() user: User,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: EditOrderItemDto,
  ) {
    return this.orders.editOrderItem(orderId, itemId, user.id, user.role, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/rider/arrived')
  async markRiderArrived(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.markRiderArrived(id, user.id, user.role);
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
    if (user.role === 'RIDER') {
      const canViewOpenPool =
        order.orderStatus === 'READY_FOR_PICKUP' && order.riderId == null;
      if (order.riderId !== user.id && !canViewOpenPool) {
        throw new ForbiddenException('Order not found');
      }
    }
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
