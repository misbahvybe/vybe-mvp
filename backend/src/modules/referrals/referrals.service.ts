import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async processCompletedFirstOrder(customerId: string, orderId: string) {
    const customer = await (this.prisma.user as any).findUnique({
      where: { id: customerId },
      select: { id: true, referredByUserId: true },
    }) as { id: string; referredByUserId: string | null } | null;
    if (!customer?.referredByUserId) return;

    const deliveredCount = await this.prisma.order.count({
      where: { customerId, orderStatus: OrderStatus.DELIVERED },
    });
    if (deliveredCount !== 1) return;

    const referralReward = (this.prisma as any).referralReward;
    const existing = await referralReward.findFirst({
      where: { referredUserId: customerId },
      select: { id: true },
    });
    if (!existing) {
      await referralReward.create({
        data: {
          referrerId: customer.referredByUserId,
          referredUserId: customerId,
          orderId,
          couponCode: await this.generateUniqueCouponCode(),
          status: 'PENDING',
          eligibleAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    await this.issueEligibleRewards();
  }

  async issueEligibleRewards() {
    const referralReward = (this.prisma as any).referralReward;
    const due = await referralReward.findMany({
      where: {
        status: 'PENDING',
        eligibleAt: { lte: new Date() },
      },
      include: {
        referrer: { select: { id: true } },
      },
      take: 100,
      orderBy: { eligibleAt: 'asc' },
    });
    for (const reward of due) {
      await referralReward.update({
        where: { id: reward.id },
        data: { status: 'ISSUED', issuedAt: new Date() },
      });
      try {
        await this.notifications.create({
          userId: reward.referrer.id,
          type: 'REFERRAL_REWARD',
          title: 'Referral reward unlocked!',
          body: `Your coupon code ${reward.couponCode} is now active.`,
          data: { couponCode: reward.couponCode, rewardId: reward.id },
        });
      } catch (e) {
        this.logger.warn(`Failed to notify referrer for reward ${reward.id}: ${String(e)}`);
      }
    }
  }

  async getReferralSummary(userId: string) {
    const referralReward = (this.prisma as any).referralReward;
    const [user, totalReferrals, completedReferrals, rewardsIssued] = await Promise.all([
      (this.prisma.user as any).findUnique({
        where: { id: userId },
        select: { referralCode: true },
      }),
      (this.prisma.user as any).count({ where: { referredByUserId: userId } }),
      referralReward.count({ where: { referrerId: userId } }),
      referralReward.count({
        where: { referrerId: userId, status: 'ISSUED' },
      }),
    ]);
    return {
      referralCode: user?.referralCode ?? null,
      totalReferrals,
      completedReferrals,
      rewardsIssued,
    };
  }

  private async generateUniqueCouponCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = `VYBE-RWD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const exists = await (this.prisma as any).referralReward.findFirst({
        where: { couponCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    return `VYBE-RWD-${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
  }
}

