import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PharmacyIngestionService } from './pharmacy-ingestion.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [PrismaModule, StoresModule],
  controllers: [AdminController],
  providers: [AdminService, PharmacyIngestionService],
  exports: [AdminService],
})
export class AdminModule {}
