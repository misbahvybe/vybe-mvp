import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Socket.IO polling issues many HTTP requests; exclude them from the global rate limit.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<{ url?: string; method?: string }>();
      if (req.method === 'OPTIONS') {
        return true;
      }
      if (typeof req?.url === 'string' && req.url.startsWith('/socket.io')) {
        return true;
      }
    }
    return (await super.canActivate(context)) as boolean;
  }
}
