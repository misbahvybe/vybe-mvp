import { Global, Module } from '@nestjs/common';
import { UpstashService } from './upstash.service';

@Global()
@Module({
  providers: [UpstashService],
  exports: [UpstashService],
})
export class UpstashModule {}
