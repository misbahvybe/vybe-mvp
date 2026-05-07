import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
// CJS module: default import becomes `require(...).default` → undefined without esModuleInterop
import * as webpush from 'web-push';
import type { Expo, ExpoPushMessage } from 'expo-server-sdk';

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
  private expoClient: Expo | null = null;
  private expoModulePromise: Promise<{ Expo: typeof Expo }> | null = null;

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

  private async getExpo(): Promise<Expo> {
    if (this.expoClient) return this.expoClient;
    if (!this.expoModulePromise) {
      // `expo-server-sdk` is ESM-only on newer versions. Nest builds CJS, so we must load it dynamically.
      this.expoModulePromise = import('expo-server-sdk') as any;
    }
    const mod = await this.expoModulePromise;
    // @ts-expect-error runtime module provides Expo constructor
    this.expoClient = new mod.Expo();
    return this.expoClient;
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

  async upsertMobileToken(params: {
    userId: string;
    token: string;
    platform?: string | null;
    deviceName?: string | null;
  }) {
    const mobilePushToken = (this.prisma as any).mobilePushToken;
    return mobilePushToken.upsert({
      where: { token: params.token },
      update: {
        userId: params.userId,
        platform: params.platform ?? null,
        deviceName: params.deviceName ?? null,
      },
      create: {
        userId: params.userId,
        token: params.token,
        platform: params.platform ?? null,
        deviceName: params.deviceName ?? null,
      },
    });
  }

  async removeMobileToken(token: string, userId: string) {
    await (this.prisma as any).mobilePushToken.deleteMany({ where: { token, userId } });
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

  async sendMobileToUser(
    userId: string,
    payload: PushPayload & { channelId?: string; sound?: 'default' | null; priority?: 'default' | 'high' },
  ): Promise<{ sent: number }> {
    const mod = (await (this.expoModulePromise ?? (this.expoModulePromise = (import('expo-server-sdk') as any)))) as any;
    const rows = await (this.prisma as any).mobilePushToken.findMany({
      where: { userId },
      select: { token: true },
      take: 20,
    });
    const tokens = (rows as Array<{ token: string }>)
      .map((r: { token: string }) => r.token)
      .filter((t: string) => mod.Expo?.isExpoPushToken?.(t));
    if (tokens.length === 0) return { sent: 0 };

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body ?? undefined,
      data: payload.data ?? undefined,
      sound: payload.sound ?? 'default',
      priority: payload.priority ?? 'high',
      channelId: payload.channelId ?? 'orders',
    }));

    let sent = 0;
    const expo = await this.getExpo();
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'ok') {
            sent++;
            continue;
          }
          const details = (ticket as { details?: { error?: string } }).details;
          const err = details?.error ?? 'unknown';
          const badToken = chunk[i]?.to;
          if (err === 'DeviceNotRegistered' && typeof badToken === 'string') {
            await (this.prisma as any).mobilePushToken.deleteMany({ where: { token: badToken, userId } });
          }
        }
      } catch (e) {
        this.logger.warn(`Failed mobile push chunk send: ${String(e)}`);
      }
    }
    return { sent };
  }
}

