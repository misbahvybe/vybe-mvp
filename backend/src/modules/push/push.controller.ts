import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('status')
  status() {
    return { configured: this.push.isConfigured() };
  }

  @Get('vapid-public-key')
  vapidPublicKey() {
    // Frontend can use NEXT_PUBLIC_VAPID_PUBLIC_KEY too; this is a fallback.
    // We intentionally do not expose the private key.
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
  }

  @Get('ping')
  async ping(@CurrentUser() user: User) {
    return this.push.sendToUser(user.id, { title: 'Vybe push test', body: 'If you see this, push works.', url: '/store/pos' });
  }

  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: User,
    @Body()
    body: {
      endpoint: string;
      keys?: { p256dh?: string; auth?: string };
    },
  ) {
    const endpoint = String(body?.endpoint ?? '').trim();
    const p256dh = String(body?.keys?.p256dh ?? '').trim();
    const auth = String(body?.keys?.auth ?? '').trim();
    return this.push.upsertSubscription({
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent: null,
    });
  }

  @Post('mobile/register')
  async registerMobileToken(
    @CurrentUser() user: User,
    @Body() body: { token: string; platform?: string; deviceName?: string },
  ) {
    const token = String(body?.token ?? '').trim();
    if (!token) return { ok: false, message: 'token is required' };
    return this.push.upsertMobileToken({
      userId: user.id,
      token,
      platform: body?.platform ?? null,
      deviceName: body?.deviceName ?? null,
    });
  }

  @Delete('mobile/unregister')
  async unregisterMobileToken(
    @CurrentUser() user: User,
    @Body() body: { token: string },
  ) {
    return this.push.removeMobileToken(String(body?.token ?? '').trim(), user.id);
  }

  @Delete('unsubscribe')
  async unsubscribe(
    @CurrentUser() user: User,
    @Body() body: { endpoint: string },
  ) {
    return this.push.removeSubscription(String(body?.endpoint ?? ''), user.id);
  }
}

