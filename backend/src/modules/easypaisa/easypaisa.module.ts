import { Module } from '@nestjs/common';
import { EasypaisaService } from './easypaisa.service';

@Module({
  providers: [EasypaisaService],
  exports: [EasypaisaService],
})
export class EasypaisaModule {}

