import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PricingModule } from '../pricing/pricing.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { StoresModule } from '../stores/stores.module';
import { JazzCashModule } from '../jazzcash/jazzcash.module';
import { EasypaisaModule } from '../easypaisa/easypaisa.module';
import { RidersModule } from '../riders/riders.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PricingModule, RealtimeModule, StoresModule, JazzCashModule, EasypaisaModule, RidersModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
