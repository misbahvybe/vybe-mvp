import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'vybepk-api',
      /** Set by Railway — use to confirm the running image matches your latest deploy. */
      gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT ?? null,
    };
  }
}
