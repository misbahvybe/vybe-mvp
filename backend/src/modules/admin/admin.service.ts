import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreatePartnerDto } from './dto/create-partner.dto';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createPartner(adminId: string, dto: CreatePartnerDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone.replace(/\D/g, '').replace(/^0/, '92') }],
      },
    });
    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const normalizedPhone = dto.phone.replace(/\D/g, '').replace(/^0/, '92');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: normalizedPhone,
        role: dto.role,
        isVerified: true,
        isActive: dto.isActive ?? true,
        passwordSet: false,
        invitationToken,
        invitationExpiresAt,
      },
    });
    await this.prisma.adminLog.create({
      data: { adminId, action: `CREATE_PARTNER_${dto.role}`, targetId: user.id },
    });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/partner-invite?token=${invitationToken}`;
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, inviteLink };
  }

  async listPartners(adminId: string) {
    const users = await this.prisma.user.findMany({
      where: { role: { in: [Role.RIDER, Role.STORE_OWNER] } },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, passwordSet: true, createdAt: true, invitationExpiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  async getMetrics() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalUsers,
      totalOrdersAll,
      ordersTodayCount,
      revenueTodayAgg,
      totalRevenueAgg,
      activeRiders,
      activeStores,
      orderCountsByStatus,
      cancelledToday,
      deliveredWithHistory,
      allOrdersForCancellation,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart }, orderStatus: { notIn: ['CANCELLED', 'STORE_REJECTED'] } } }),
      this.prisma.storeEarning.aggregate({
        where: { createdAt: { gte: todayStart, lt: tomorrow } },
        _sum: { commissionAmount: true },
      }),
      this.prisma.storeEarning.aggregate({ _sum: { commissionAmount: true } }),
      this.prisma.user.count({ where: { role: 'RIDER', isActive: true } }),
      this.prisma.store.count({ where: { isApproved: true } }),
      this.prisma.order.groupBy({
        by: ['orderStatus'],
        where: { orderStatus: { notIn: ['CANCELLED', 'STORE_REJECTED'] } },
        _count: true,
      }),
      this.prisma.order.count({ where: { orderStatus: { in: ['CANCELLED', 'STORE_REJECTED'] }, createdAt: { gte: todayStart } } }),
      this.prisma.order.findMany({
        where: { orderStatus: 'DELIVERED' },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.order.count(),
    ]);

    const revenueToday = Number(revenueTodayAgg._sum.commissionAmount ?? 0);
    const totalRevenue = Number(totalRevenueAgg._sum.commissionAmount ?? 0);

    let avgDeliveryTimeMins = 0;
    let deliveredCount = 0;
    for (const o of deliveredWithHistory) {
      const readyAt = o.statusHistory.find((h) => h.status === 'READY_FOR_PICKUP' || h.status === 'RIDER_ASSIGNED')?.createdAt;
      const deliveredAt = o.statusHistory.find((h) => h.status === 'DELIVERED')?.createdAt;
      if (readyAt && deliveredAt) {
        avgDeliveryTimeMins += (new Date(deliveredAt).getTime() - new Date(readyAt).getTime()) / 60000;
        deliveredCount++;
      }
    }
    if (deliveredCount > 0) avgDeliveryTimeMins = Math.round(avgDeliveryTimeMins / deliveredCount);

    const cancelledAll = await this.prisma.order.count({ where: { orderStatus: { in: ['CANCELLED', 'STORE_REJECTED'] } } });
    const cancellationRate = allOrdersForCancellation > 0 ? ((cancelledAll / allOrdersForCancellation) * 100).toFixed(1) : '0';

    const statusCounts: Record<string, number> = {};
    orderCountsByStatus.forEach((s) => { statusCounts[s.orderStatus] = s._count; });

    const pending = statusCounts.PENDING ?? 0;
    const preparing = (statusCounts.STORE_ACCEPTED ?? 0);
    const readyForPickup = statusCounts.READY_FOR_PICKUP ?? 0;
    const outForDelivery = (statusCounts.RIDER_ASSIGNED ?? 0) + (statusCounts.RIDER_ACCEPTED ?? 0) + (statusCounts.PICKED_UP ?? 0);

    const totalServiceFee = await this.prisma.order.aggregate({
      where: { orderStatus: 'DELIVERED' },
      _sum: { serviceFee: true },
    });
    const totalDeliveryFee = await this.prisma.order.aggregate({
      where: { orderStatus: 'DELIVERED' },
      _sum: { deliveryFee: true },
    });
    const totalRiderCost = await this.prisma.riderEarning.aggregate({ _sum: { earningAmount: true } });
    const avgOrderValue = deliveredWithHistory.length > 0
      ? deliveredWithHistory.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0) / deliveredWithHistory.length
      : 0;
    const commissionRate = 0.15;
    const serviceFeePerOrder = 23.49;
    const avgRiderCost = deliveredWithHistory.length > 0
      ? Number(totalRiderCost._sum.earningAmount ?? 0) / deliveredWithHistory.length
      : 150;
    const contributionMargin = (avgOrderValue * commissionRate) + serviceFeePerOrder - avgRiderCost;

    return {
      totalUsers,
      totalOrders: totalOrdersAll,
      ordersToday: ordersTodayCount,
      revenueToday,
      totalRevenue,
      activeRiders,
      activeStores,
      avgDeliveryTimeMins,
      cancellationRate,
      orderCountsByStatus: { pending, preparing, readyForPickup, outForDelivery, cancelledToday },
      contributionMargin: { avgOrderValue, commission: avgOrderValue * commissionRate, serviceFee: serviceFeePerOrder, riderCost: avgRiderCost, net: contributionMargin },
    };
  }

  async getAlerts() {
    const now = new Date();
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [pendingStuck, readyOrders, storesClosed, ridersInactive] = await Promise.all([
      this.prisma.order.findMany({
        where: { orderStatus: 'PENDING', createdAt: { lt: tenMinsAgo } },
        include: { store: { select: { name: true } } },
      }),
      this.prisma.order.findMany({
        where: { orderStatus: 'READY_FOR_PICKUP' },
        include: { statusHistory: { where: { status: 'READY_FOR_PICKUP' }, orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.getStoresClosedDuringHours(),
      this.prisma.riderProfile.findMany({
        where: { updatedAt: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }, isAvailable: true },
        include: { user: { select: { name: true } } },
      }),
    ]);

    const readyStuck = readyOrders.filter((o) => {
      const h = o.statusHistory[0];
      return h && new Date(h.createdAt) < fifteenMinsAgo;
    });

    return {
      ordersPendingStuck: pendingStuck.map((o) => ({ id: o.id, storeName: o.store?.name, createdAt: o.createdAt })),
      ordersReadyStuck: readyStuck.map((o) => o.id),
      storesClosedDuringHours: storesClosed,
      ridersInactiveOver2Hours: ridersInactive.map((r) => ({ id: r.userId, name: (r.user as { name?: string })?.name })),
    };
  }

  private async getStoresClosedDuringHours(): Promise<{ id: string; name: string }[]> {
    const stores = await this.prisma.store.findMany({
      where: { isApproved: true, isOpen: false, openingTime: { not: null }, closingTime: { not: null } },
      select: { id: true, name: true, openingTime: true, closingTime: true },
    });
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return stores.filter((s) => {
      if (!s.openingTime || !s.closingTime) return false;
      const [oh, om] = s.openingTime.split(':').map(Number);
      const [ch, cm] = s.closingTime.split(':').map(Number);
      const openMins = oh * 60 + om;
      let closeMins = ch * 60 + cm;
      if (closeMins <= openMins) closeMins += 24 * 60;
      return nowMins >= openMins && nowMins < closeMins;
    }).map((s) => ({ id: s.id, name: s.name }));
  }

  async getStores() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const stores = await this.prisma.store.findMany({
      where: { isApproved: true },
      include: {
        owner: { select: { name: true } },
        orders: { where: { createdAt: { gte: todayStart } }, select: { id: true, totalAmount: true, orderStatus: true } },
        earnings: { where: { createdAt: { gte: todayStart } }, select: { commissionAmount: true, storeAmount: true } },
      },
    });
    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      isOpen: s.isOpen,
      openingTime: s.openingTime,
      closingTime: s.closingTime,
      ordersToday: s.orders.length,
      revenueToday: s.orders.filter((o) => o.orderStatus === 'DELIVERED').reduce((sum, o) => sum + Number(o.totalAmount), 0),
      isApproved: s.isApproved,
    }));
  }

  async getRiders() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const riders = await this.prisma.user.findMany({
      where: { role: 'RIDER' },
      include: {
        riderProfile: true,
        ordersAsRider: { include: { statusHistory: true } },
        riderEarnings: true,
      },
    });
    return riders.map((r) => {
      const todayOrders = r.ordersAsRider.filter((o) => new Date(o.createdAt) >= todayStart);
      const delivered = r.ordersAsRider.filter((o) => o.orderStatus === 'DELIVERED');
      let avgDeliveryMins = 0;
      delivered.forEach((o) => {
        const ready = o.statusHistory.find((h) => h.status === 'READY_FOR_PICKUP' || h.status === 'RIDER_ASSIGNED')?.createdAt;
        const deliv = o.statusHistory.find((h) => h.status === 'DELIVERED')?.createdAt;
        if (ready && deliv) avgDeliveryMins += (new Date(deliv).getTime() - new Date(ready).getTime()) / 60000;
      });
      if (delivered.length > 0) avgDeliveryMins /= delivered.length;
      const assigned = r.ordersAsRider.filter((o) => o.orderStatus === 'RIDER_ASSIGNED').length;
      const accepted = r.ordersAsRider.filter((o) => o.orderStatus !== 'RIDER_ASSIGNED').length;
      const acceptanceRate = assigned + accepted > 0 ? ((accepted / (assigned + accepted)) * 100).toFixed(0) : '0';
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        isActive: r.isActive,
        isOnline: r.riderProfile?.isAvailable ?? false,
        ordersToday: todayOrders.length,
        totalOrders: r.ordersAsRider.length,
        avgDeliveryTimeMins: Math.round(avgDeliveryMins),
        acceptanceRate,
        totalEarnings: r.riderEarnings.reduce((s, e) => s + Number(e.earningAmount), 0),
      };
    });
  }

  async getUsers() {
    const customers = await this.prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      include: {
        ordersAsCustomer: { select: { orderStatus: true, totalAmount: true } },
      },
    });
    return customers.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      isVerified: u.isVerified,
      isActive: u.isActive,
      ordersCount: u.ordersAsCustomer.filter((o: { orderStatus: string }) => o.orderStatus === 'DELIVERED').length,
      totalSpend: u.ordersAsCustomer
        .filter((o: { orderStatus: string; totalAmount: unknown }) => o.orderStatus === 'DELIVERED')
        .reduce((s: number, o: { totalAmount: unknown }) => s + Number(o.totalAmount), 0),
    }));
  }

  async getFinance() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayOrders, monthOrders, todayEarnings, monthEarnings] = await Promise.all([
      this.prisma.order.findMany({ where: { orderStatus: 'DELIVERED', createdAt: { gte: todayStart } } }),
      this.prisma.order.findMany({ where: { orderStatus: 'DELIVERED', createdAt: { gte: monthStart } } }),
      this.prisma.storeEarning.findMany({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.storeEarning.findMany({ where: { createdAt: { gte: monthStart } } }),
    ]);

    const todayGmv = todayOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const monthGmv = monthOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const todayCommission = todayEarnings.reduce((s, e) => s + Number(e.commissionAmount), 0);
    const monthCommission = monthEarnings.reduce((s, e) => s + Number(e.commissionAmount), 0);
    const todayServiceFees = todayOrders.reduce((s, o) => s + Number(o.serviceFee ?? 0), 0);
    const monthServiceFees = monthOrders.reduce((s, o) => s + Number(o.serviceFee ?? 0), 0);
    const todayDeliveryFees = todayOrders.reduce((s, o) => s + Number(o.deliveryFee ?? 0), 0);
    const monthDeliveryFees = monthOrders.reduce((s, o) => s + Number(o.deliveryFee ?? 0), 0);

    const todayRiderCost = await this.prisma.riderEarning.aggregate({
      where: { createdAt: { gte: todayStart } },
      _sum: { earningAmount: true },
    });
    const monthRiderCost = await this.prisma.riderEarning.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { earningAmount: true },
    });

    const cancelledMonth = await this.prisma.order.count({
      where: { orderStatus: { in: ['CANCELLED', 'STORE_REJECTED'] }, createdAt: { gte: monthStart } },
    });
    const cancelledMonthValue = await this.prisma.order.aggregate({
      where: { orderStatus: { in: ['CANCELLED', 'STORE_REJECTED'] }, createdAt: { gte: monthStart } },
      _sum: { subtotalAmount: true },
    });

    return {
      today: {
        grossGmv: todayGmv,
        platformCommission: todayCommission,
        serviceFeesCollected: todayServiceFees,
        deliveryFeesCollected: todayDeliveryFees,
        riderCost: Number(todayRiderCost._sum.earningAmount ?? 0),
        netPlatformRevenue: todayCommission + todayServiceFees - Number(todayRiderCost._sum.earningAmount ?? 0),
      },
      month: {
        totalGmv: monthGmv,
        totalCommission: monthCommission,
        totalServiceFees: monthServiceFees,
        totalDeliveryFees: monthDeliveryFees,
        cancellationLoss: Number(cancelledMonthValue._sum.subtotalAmount ?? 0),
        cancelledOrders: cancelledMonth,
      },
    };
  }

  async getMetricsCharts() {
    const days: { date: string; orders: number; revenue: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const [orders, earnings] = await Promise.all([
        this.prisma.order.count({ where: { orderStatus: 'DELIVERED', createdAt: { gte: d, lt: next } } }),
        this.prisma.storeEarning.aggregate({ where: { createdAt: { gte: d, lt: next } }, _sum: { commissionAmount: true } }),
      ]);
      days.push({
        date: d.toISOString().slice(0, 10),
        orders,
        revenue: Number(earnings._sum.commissionAmount ?? 0),
      });
    }
    return days;
  }
}
