import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { BankPaymentsController } from './bank-payments.controller';
import { BankPaymentsService } from './bank-payments.service';

@Module({
  imports: [PrismaModule, PricingModule],
  controllers: [BankPaymentsController],
  providers: [BankPaymentsService],
  exports: [BankPaymentsService],
})
export class BankPaymentsModule {}
