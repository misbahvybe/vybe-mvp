import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WithdrawService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rider: sum of delivery earnings minus payouts and minus open withdraw requests. */
  async getRiderFinancialSnapshot(riderId: string) {
    const [earned, paidOut, reserved] = await Promise.all([
      this.prisma.riderEarning.aggregate({
        where: { riderId },
        _sum: { earningAmount: true },
      }),
      this.prisma.earningPayout.aggregate({
        where: { userId: riderId, role: Role.RIDER },
        _sum: { amountPkr: true },
      }),
      this.prisma.withdrawRequest.aggregate({
        where: { userId: riderId, status: { in: ['PENDING', 'APPROVED'] } },
        _sum: { amount: true },
      }),
    ]);
    const totalEarned = Number(earned._sum.earningAmount ?? 0);
    const totalPaidOut = Number(paidOut._sum.amountPkr ?? 0);
    const reservedAmt = Number(reserved._sum.amount ?? 0);
    const available = Math.max(0, totalEarned - totalPaidOut - reservedAmt);
    return { totalEarned, totalPaidOut, reserved: reservedAmt, available };
  }

  /** Store owner: delivered order store amounts minus payouts and open withdraw requests. */
  async getStoreOwnerFinancialSnapshot(ownerId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId }, select: { id: true } });
    if (!store) {
      return {
        storeId: null as string | null,
        totalEarned: 0,
        totalPaidOut: 0,
        reserved: 0,
        available: 0,
      };
    }
    const [earned, paidOut, reserved] = await Promise.all([
      this.prisma.storeEarning.aggregate({
        where: { storeId: store.id, order: { orderStatus: 'DELIVERED' } },
        _sum: { storeAmount: true },
      }),
      this.prisma.earningPayout.aggregate({
        where: { userId: ownerId, role: Role.STORE_OWNER, storeId: store.id },
        _sum: { amountPkr: true },
      }),
      this.prisma.withdrawRequest.aggregate({
        where: { userId: ownerId, status: { in: ['PENDING', 'APPROVED'] } },
        _sum: { amount: true },
      }),
    ]);
    const totalEarned = Number(earned._sum.storeAmount ?? 0);
    const totalPaidOut = Number(paidOut._sum.amountPkr ?? 0);
    const reservedAmt = Number(reserved._sum.amount ?? 0);
    const available = Math.max(0, totalEarned - totalPaidOut - reservedAmt);
    return {
      storeId: store.id,
      totalEarned,
      totalPaidOut,
      reserved: reservedAmt,
      available,
    };
  }

  async requestWithdraw(userId: string, role: Role, amount: number) {
    if (!['RIDER', 'STORE_OWNER'].includes(role)) {
      throw new BadRequestException('Withdrawals are only available for riders and store owners');
    }
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const snap =
      role === Role.RIDER
        ? await this.getRiderFinancialSnapshot(userId)
        : await this.getStoreOwnerFinancialSnapshot(userId);

    if (amount > snap.available + 1e-6) {
      throw new BadRequestException(
        `Amount exceeds available balance (Rs ${snap.available.toFixed(2)} available)`,
      );
    }

    return this.prisma.withdrawRequest.create({
      data: {
        userId,
        role,
        amount,
        status: 'PENDING',
      },
    });
  }

  async listAll() {
    return this.prisma.withdrawRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, role: true },
        },
      },
    });
  }

  async listPayoutsForAdmin(take = 100) {
    return this.prisma.earningPayout.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, phone: true, role: true } },
        withdrawRequest: { select: { id: true, amount: true, status: true, note: true } },
      },
    });
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID',
    note: string | undefined,
    adminId: string,
  ) {
    if (!['PENDING', 'APPROVED', 'REJECTED', 'PAID'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const now = status === 'PAID' || status === 'REJECTED' || status === 'APPROVED' ? new Date() : null;

    return this.prisma.$transaction(async (tx) => {
      const req = await tx.withdrawRequest.findUnique({
        where: { id },
        include: { earningPayout: true },
      });
      if (!req) throw new NotFoundException('Withdraw request not found');

      if (req.status === 'PAID' && status !== 'PAID') {
        throw new BadRequestException('Cannot change a completed payout');
      }
      if (req.status === 'PAID' && status === 'PAID') {
        return tx.withdrawRequest.findUniqueOrThrow({
          where: { id },
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true, role: true },
            },
          },
        });
      }

      if (status === 'PAID') {
        if (req.status !== 'APPROVED') {
          throw new BadRequestException('Only APPROVED requests can be marked as PAID');
        }
        if (req.earningPayout) {
          throw new BadRequestException('Payout already recorded for this request');
        }

        const amountNum = Number(req.amount);
        const ownerId = req.userId;
        const role = req.role;

        const reservedOther = await tx.withdrawRequest.aggregate({
          where: {
            userId: ownerId,
            status: { in: ['PENDING', 'APPROVED'] },
            id: { not: id },
          },
          _sum: { amount: true },
        });
        const reservedOtherNum = Number(reservedOther._sum.amount ?? 0);

        let earned = 0;
        let paidOut = 0;
        let storeId: string | null = null;

        if (role === Role.RIDER) {
          const e = await tx.riderEarning.aggregate({
            where: { riderId: ownerId },
            _sum: { earningAmount: true },
          });
          const p = await tx.earningPayout.aggregate({
            where: { userId: ownerId, role: Role.RIDER },
            _sum: { amountPkr: true },
          });
          earned = Number(e._sum.earningAmount ?? 0);
          paidOut = Number(p._sum.amountPkr ?? 0);
        } else {
          const store = await tx.store.findFirst({ where: { ownerId }, select: { id: true } });
          if (!store) throw new BadRequestException('Store not found for owner');
          storeId = store.id;
          const e = await tx.storeEarning.aggregate({
            where: { storeId: store.id, order: { orderStatus: 'DELIVERED' } },
            _sum: { storeAmount: true },
          });
          const p = await tx.earningPayout.aggregate({
            where: { userId: ownerId, role: Role.STORE_OWNER, storeId: store.id },
            _sum: { amountPkr: true },
          });
          earned = Number(e._sum.storeAmount ?? 0);
          paidOut = Number(p._sum.amountPkr ?? 0);
        }

        const maxPayable = earned - paidOut - reservedOtherNum;
        if (amountNum > maxPayable + 0.01) {
          throw new BadRequestException(
            `Insufficient cleared balance to pay Rs ${amountNum.toFixed(2)} (max Rs ${maxPayable.toFixed(2)})`,
          );
        }

        await tx.earningPayout.create({
          data: {
            userId: ownerId,
            role,
            storeId,
            amountPkr: req.amount,
            withdrawRequestId: id,
          },
        });

        await tx.adminLog.create({
          data: {
            adminId,
            action: `WITHDRAW_PAID:${amountNum.toFixed(2)} PKR (${role})`,
            targetId: id,
          },
        });

        return tx.withdrawRequest.update({
          where: { id },
          data: {
            status: 'PAID',
            note,
            processedAt: now,
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true, role: true },
            },
          },
        });
      }

      const updated = await tx.withdrawRequest.update({
        where: { id },
        data: {
          status,
          note,
          processedAt: now,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
        },
      });

      if ((status === 'APPROVED' || status === 'REJECTED') && req.status !== status) {
        await tx.adminLog.create({
          data: {
            adminId,
            action: `WITHDRAW_${status}:${Number(req.amount).toFixed(2)} PKR (${req.role})`,
            targetId: id,
          },
        });
      }

      return updated;
    });
  }
}
