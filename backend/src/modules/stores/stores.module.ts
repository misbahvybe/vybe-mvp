import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { StoreOwnerController } from './store-owner.controller';

@Module({
  controllers: [StoresController, StoreOwnerController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
