import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    // Socket.IO handshake is HTTP without Bearer header; JWT is in handshake.auth (verified in OrdersGateway).
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<{ url?: string; method?: string }>();
      // CORS preflight must not require JWT or the response has no Access-Control-Allow-Origin.
      if (req.method === 'OPTIONS') {
        return true;
      }
      if (typeof req?.url === 'string' && req.url.startsWith('/socket.io')) {
        return true;
      }
    }
    return super.canActivate(context);
  }
}
