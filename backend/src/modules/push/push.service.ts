import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import webpush from 'web-push';

type PushPayload = {
  title: string;
  body?: string | null;
  url?: string;
  tag?: string;
  data?: any;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:support@vybe.local';
    if (pub && priv) {
      webpush.setVapidDetails(subject, pub, priv);
      this.configured = true;
    } else {
      this.logger.warn('Web push not configured (missing VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async upsertSubscription(params: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }) {
    return this.prisma.webPushSubscription.upsert({
      where: { endpoint: params.endpoint },
      update: {
        userId: params.userId,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent ?? null,
      },
      create: {
        userId: params.userId,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  async removeSubscription(endpoint: string, userId: string) {
    await this.prisma.webPushSubscription.deleteMany({ where: { endpoint, userId } });
    return { ok: true as const };
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number }> {
    if (!this.configured) return { sent: 0 };
    const subs = await this.prisma.webPushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
      take: 20,
    });
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
          { TTL: 60, urgency: 'high' as any },
        );
        sent++;
      } catch (e: any) {
        const code = e?.statusCode ?? e?.status ?? null;
        // Subscription expired / gone
        if (code === 404 || code === 410) {
          await this.prisma.webPushSubscription.deleteMany({ where: { endpoint: s.endpoint, userId } });
        }
      }
    }
    return { sent };
  }
}

