import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class RidersService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(riderId: string) {
    let profile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderId },
    });
    if (!profile) {
      profile = await this.prisma.riderProfile.create({
        data: { userId: riderId, isAvailable: true },
      });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [earningsAgg, completedCount] = await Promise.all([
      this.prisma.riderEarning.aggregate({
        where: {
          riderId,
          createdAt: { gte: today, lt: tomorrow },
        },
        _sum: { earningAmount: true },
      }),
      this.prisma.riderEarning.count({
        where: {
          riderId,
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
    ]);
    const todayEarnings = Number(earningsAgg._sum.earningAmount ?? 0);
    return {
      isAvailable: profile.isAvailable,
      todayEarnings,
      completedToday: completedCount,
    };
  }

  async setAvailable(riderId: string, isAvailable: boolean) {
    await this.prisma.riderProfile.upsert({
      where: { userId: riderId },
      update: { isAvailable },
      create: { userId: riderId, isAvailable },
    });
    return { isAvailable };
  }

  async getEarnings(riderId: string) {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const [todayAgg, weekAgg, totalAgg, history] = await Promise.all([
      this.prisma.riderEarning.aggregate({
        where: { riderId, createdAt: { gte: today, lt: tomorrow } },
        _sum: { earningAmount: true },
        _count: true,
      }),
      this.prisma.riderEarning.aggregate({
        where: { riderId, createdAt: { gte: weekStart } },
        _sum: { earningAmount: true },
        _count: true,
      }),
      this.prisma.riderEarning.aggregate({
        where: { riderId },
        _sum: { earningAmount: true },
        _count: true,
      }),
      this.prisma.riderEarning.findMany({
        where: { riderId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { order: { select: { id: true, createdAt: true } } },
      }),
    ]);
    return {
      today: { amount: Number(todayAgg._sum.earningAmount ?? 0), count: todayAgg._count },
      week: { amount: Number(weekAgg._sum.earningAmount ?? 0), count: weekAgg._count },
      total: { amount: Number(totalAgg._sum.earningAmount ?? 0), count: totalAgg._count },
      history: history.map((e) => ({
        orderId: e.orderId,
        createdAt: e.order.createdAt,
        amount: Number(e.earningAmount),
      })),
    };
  }
}
