import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);
  private static readonly REWARD_PERCENT = 5;
  private static readonly REWARD_CAP_PKR = 300;

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
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { totalAmount: true },
      });
      const orderTotal = Number(order?.totalAmount ?? 0);
      const rewardAmount = this.computeRewardAmount(orderTotal);
      await referralReward.create({
        data: {
          referrerId: customer.referredByUserId,
          referredUserId: customerId,
          orderId,
          couponCode: await this.generateUniqueCouponCode(),
          rewardAmount,
          status: 'PENDING',
          eligibleAt: new Date(),
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
      const rewardAmount = Number(reward.rewardAmount ?? 0);
      await this.prisma.$transaction(async (tx) => {
        const walletModel = (tx as any).referralDiscountWallet;
        const entryModel = (tx as any).referralWalletEntry;

        const wallet = await walletModel.upsert({
          where: { userId: reward.referrer.id },
          create: { userId: reward.referrer.id, balance: rewardAmount },
          update: { balance: { increment: rewardAmount } },
        });
        await entryModel.create({
          data: {
            walletId: wallet.id,
            userId: reward.referrer.id,
            rewardId: reward.id,
            entryType: 'CREDIT_REFERRAL',
            amount: rewardAmount,
            note: `Referral reward for order ${reward.orderId}`,
          },
        });
        await referralReward.update({
          where: { id: reward.id },
          data: { status: 'ISSUED', issuedAt: new Date() },
        });
      });
      try {
        await this.notifications.create({
          userId: reward.referrer.id,
          type: 'REFERRAL_REWARD',
          title: 'Referral reward added to wallet',
          body: `Rs ${rewardAmount.toFixed(2)} discount credit added. Use it on your next checkout.`,
          data: { couponCode: reward.couponCode, rewardId: reward.id, amount: rewardAmount },
        });
      } catch (e) {
        this.logger.warn(`Failed to notify referrer for reward ${reward.id}: ${String(e)}`);
      }
    }
  }

  async getReferralSummary(userId: string) {
    const referralReward = (this.prisma as any).referralReward;
    const [user, totalReferrals, completedReferrals, rewardsIssued, wallet, latestRewards] = await Promise.all([
      (this.prisma.user as any).findUnique({
        where: { id: userId },
        select: { referralCode: true },
      }),
      (this.prisma.user as any).count({ where: { referredByUserId: userId } }),
      referralReward.count({ where: { referrerId: userId } }),
      referralReward.count({
        where: { referrerId: userId, status: 'ISSUED' },
      }),
      (this.prisma as any).referralDiscountWallet.findUnique({
        where: { userId },
        select: { balance: true },
      }),
      referralReward.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          couponCode: true,
          rewardAmount: true,
          issuedAt: true,
          createdAt: true,
          referredUserId: true,
        },
      }),
    ]);
    return {
      referralCode: user?.referralCode ?? null,
      totalReferrals,
      completedReferrals,
      rewardsIssued,
      rewardWalletBalance: Number(wallet?.balance ?? 0),
      latestRewards: latestRewards.map((r: any) => ({
        id: r.id,
        status: r.status,
        couponCode: r.couponCode,
        rewardAmount: Number(r.rewardAmount ?? 0),
        issuedAt: r.issuedAt,
        createdAt: r.createdAt,
        referredUserId: r.referredUserId,
      })),
    };
  }

  async getWalletBalance(userId: string): Promise<number> {
    const wallet = await (this.prisma as any).referralDiscountWallet.findUnique({
      where: { userId },
      select: { balance: true },
    });
    return Number(wallet?.balance ?? 0);
  }

  async listWalletEntries(userId: string, take = 20) {
    const wallet = await (this.prisma as any).referralDiscountWallet.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });
    if (!wallet) {
      return { balance: 0, entries: [] };
    }
    const entries = await (this.prisma as any).referralWalletEntry.findMany({
      where: { walletId: wallet.id, userId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(100, take)),
      select: {
        id: true,
        entryType: true,
        amount: true,
        note: true,
        orderId: true,
        rewardId: true,
        createdAt: true,
      },
    });
    return {
      balance: Number(wallet.balance ?? 0),
      entries: entries.map((e: any) => ({ ...e, amount: Number(e.amount ?? 0) })),
    };
  }

  async resolveRequestedWalletCredit(
    userId: string,
    orderTotalPkr: number,
    requestedAmount?: number | null,
    applyFullWallet?: boolean,
  ): Promise<number> {
    if (!Number.isFinite(orderTotalPkr) || orderTotalPkr <= 0) return 0;
    const balance = await this.getWalletBalance(userId);
    if (balance <= 0) return 0;
    const requested =
      applyFullWallet === true
        ? balance
        : requestedAmount != null && Number.isFinite(requestedAmount)
          ? Math.max(0, Number(requestedAmount))
          : 0;
    if (requested <= 0) return 0;
    return Math.min(balance, requested, orderTotalPkr);
  }

  async debitWalletForOrder(tx: any, userId: string, orderId: string, amount: number) {
    const debitAmount = Math.max(0, Math.round(amount * 100) / 100);
    if (!Number.isFinite(debitAmount) || debitAmount <= 0) return;

    const walletModel = (tx as any).referralDiscountWallet;
    const entryModel = (tx as any).referralWalletEntry;

    const wallet = await walletModel.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });
    if (!wallet) return;
    const current = Number(wallet.balance ?? 0);
    if (current <= 0) return;

    const applied = Math.min(current, debitAmount);
    const updated = await walletModel.updateMany({
      where: { id: wallet.id, balance: { gte: applied } },
      data: { balance: { decrement: applied } },
    });
    if (!updated || updated.count === 0) {
      throw new Error('Unable to apply wallet discount safely. Please retry checkout.');
    }

    await entryModel.create({
      data: {
        walletId: wallet.id,
        userId,
        orderId,
        entryType: 'DEBIT_ORDER',
        amount: applied,
        note: `Applied on order ${orderId}`,
      },
    });
  }

  private computeRewardAmount(orderTotalPkr: number): number {
    if (!Number.isFinite(orderTotalPkr) || orderTotalPkr <= 0) return 0;
    const raw = (orderTotalPkr * ReferralsService.REWARD_PERCENT) / 100;
    return Math.max(1, Math.min(ReferralsService.REWARD_CAP_PKR, Math.round(raw * 100) / 100));
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

