import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WithdrawService {
  constructor(private readonly prisma: PrismaService) {}

  async requestWithdraw(userId: string, role: Role, amount: number) {
    if (!['RIDER', 'STORE_OWNER'].includes(role)) {
      throw new BadRequestException('Withdrawals are only available for riders and store owners');
    }
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    return (this.prisma as any).withdrawRequest.create({
      data: {
        userId,
        role,
        amount,
        status: 'PENDING',
      },
    });
  }

  async listAll() {
    return (this.prisma as any).withdrawRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, role: true },
        },
      },
    });
  }

  async updateStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID', note?: string) {
    if (!['PENDING', 'APPROVED', 'REJECTED', 'PAID'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const now = status === 'PAID' || status === 'REJECTED' || status === 'APPROVED' ? new Date() : null;

    return (this.prisma as any).withdrawRequest.update({
      where: { id },
      data: {
        status,
        note,
        processedAt: now,
      },
    });
  }
}

