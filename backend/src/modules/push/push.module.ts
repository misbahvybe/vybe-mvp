import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  providers: [PushService, PrismaService],
  controllers: [PushController],
  exports: [PushService],
})
export class PushModule {}

