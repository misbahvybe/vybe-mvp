import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { XPayModule } from './modules/xpay/xpay.module';
import { JazzCashModule } from './modules/jazzcash/jazzcash.module';
import { EasypaisaModule } from './modules/easypaisa/easypaisa.module';
import { WithdrawModule } from './modules/withdraw/withdraw.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RidersModule } from './modules/riders/riders.module';
import { StoresModule } from './modules/stores/stores.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { BankPaymentsModule } from './modules/bank-payments/bank-payments.module';
import { UpstashModule } from './common/upstash/upstash.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UpstashModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    StripeModule,
    XPayModule,
    JazzCashModule,
    EasypaisaModule,
    WithdrawModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    RidersModule,
    StoresModule,
    AdminModule,
    NotificationsModule,
    HealthModule,
    UploadsModule,
    BankPaymentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
