import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { WithdrawService } from './withdraw.service';

@Controller('withdraw')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WithdrawController {
  constructor(private readonly withdraw: WithdrawService) {}

  @Post('request')
  @Roles('RIDER', 'STORE_OWNER')
  async request(@CurrentUser() user: User, @Body() body: { amount: number }) {
    return this.withdraw.requestWithdraw(user.id, user.role, Number(body.amount));
  }

  @Get('requests')
  @Roles('ADMIN')
  async listAll() {
    return this.withdraw.listAll();
  }

  @Patch('requests/:id')
  @Roles('ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'; note?: string },
  ) {
    return this.withdraw.updateStatus(id, body.status, body.note);
  }
}

