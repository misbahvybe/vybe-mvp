import { Global, Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [WithdrawService],
  controllers: [WithdrawController],
  exports: [WithdrawService],
})
export class WithdrawModule {}

