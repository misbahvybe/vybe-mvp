import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, any> | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  async create(input: CreateNotificationInput) {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        dataJson: input.data ? JSON.stringify(input.data) : null,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        body: true,
        dataJson: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    });

    // Emit realtime event to this user's room.
    this.gateway.emitNotification(row.userId, {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.dataJson ? safeJson(row.dataJson) : null,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt,
    });

    return row;
  }

  async listForUser(userId: string, opts?: { unreadOnly?: boolean; take?: number }) {
    const take = Math.max(1, Math.min(100, opts?.take ?? 30));
    const rows = await this.prisma.notification.findMany({
      where: { userId, ...(opts?.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        dataJson: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      data: r.dataJson ? safeJson(r.dataJson) : null,
    }));
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: row.count > 0 };
  }

  async markAllRead(userId: string) {
    const row = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true, updated: row.count };
  }
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

