import { All, Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { PrepareXPayDto } from '../orders/dto/prepare-xpay.dto';
import { BankPaymentsService, BankSlug } from './bank-payments.service';

/**
 * Bank redirect integrations (HBL, Meezan, Allied).
 *
 * Register with each bank:
 * - Customer return: GET/POST /api/v1/payments/banks/{hbl|meezan|allied}/return
 * - Server webhook:  POST /api/v1/payments/banks/{hbl|meezan|allied}/webhook
 */
@Controller('payments/banks')
export class BankPaymentsController {
  constructor(private readonly bankPayments: BankPaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':bankSlug/urls')
  urls(@Param('bankSlug') bankSlug: string) {
    const slug = this.bankPayments.assertBankSlug(bankSlug);
    return this.bankPayments.urlsForBank(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bankSlug/prepare')
  prepare(@CurrentUser() user: User, @Param('bankSlug') bankSlug: string, @Body() dto: PrepareXPayDto) {
    const slug = this.bankPayments.assertBankSlug(bankSlug);
    return this.bankPayments.prepare(user.id, slug, dto);
  }

  @Public()
  @All(':bankSlug/return')
  async bankReturn(
    @Param('bankSlug') bankSlug: string,
    @Query() query: Record<string, string>,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    let slug: BankSlug;
    try {
      slug = this.bankPayments.assertBankSlug(bankSlug);
    } catch {
      return res.redirect(302, `${frontendUrl}/cart/checkout?error=invalid_bank`);
    }
    const bodyObj =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const { redirect } = await this.bankPayments.handleReturn(slug, query, bodyObj);
    return res.redirect(302, redirect);
  }

  @Public()
  @Post(':bankSlug/webhook')
  async bankWebhook(@Param('bankSlug') bankSlug: string, @Body() body: unknown) {
    try {
      const slug = this.bankPayments.assertBankSlug(bankSlug);
      return this.bankPayments.handleWebhook(slug, body);
    } catch {
      return { ok: false, error: 'invalid_bank' };
    }
  }
}
