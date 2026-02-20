import { Module, Global } from '@nestjs/common';
import { XPayService } from './xpay.service';

@Global()
@Module({
  providers: [XPayService],
  exports: [XPayService],
})
export class XPayModule {}
