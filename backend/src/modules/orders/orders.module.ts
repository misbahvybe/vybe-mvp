import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PricingModule } from '../pricing/pricing.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [PricingModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
