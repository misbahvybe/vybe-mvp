import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpstashService } from '../../common/upstash/upstash.service';
import { StoresService } from '../stores/stores.service';
import { CheckoutServiceFeeMode, Prisma, Role, StoreStatus } from '@prisma/client';
import { RIDER_COD_COLLECTION_LIMIT_PKR } from '../../common/constants/rider-cod';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { PatchPlatformCheckoutSettingsDto } from './dto/patch-platform-checkout-settings.dto';
import * as crypto from 'crypto';
import { getWallClockMinutesInTimeZone, isWithinBusinessWindow } from '../../common/store/store-hours.util';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly upstash: UpstashService,
    private readonly stores: StoresService,
  ) {}

  private adminMetricsTtlSeconds(): number {
    const n = Number(this.config.get<string>('ADMIN_METRICS_CACHE_TTL_SECONDS') ?? 45);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 300) : 45;
  }

  private adminChartsTtlSeconds(): number {
    const n = Number(this.config.get<string>('ADMIN_METRICS_CHARTS_CACHE_TTL_SECONDS') ?? 120);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : 120;
  }

  private inviteExpiryMs(): number {
    return 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  private inviteBaseUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

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
    const invitationExpiresAt = new Date(Date.now() + this.inviteExpiryMs());
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
    if (dto.role === Role.STORE_OWNER) {
      await this.prisma.store.create({
        data: {
          ownerId: user.id,
          name: `${dto.name.trim()}'s store`,
          city: 'Lahore',
          phone: normalizedPhone,
          status: StoreStatus.INVITED,
          isApproved: true,
          isOpen: true,
        },
      });
      await this.stores.invalidatePublicStoreListCache().catch(() => undefined);
    }
    await this.prisma.adminLog.create({
      data: { adminId, action: `CREATE_PARTNER_${dto.role}`, targetId: user.id },
    });
    const inviteLink = `${this.inviteBaseUrl()}/partner-invite?token=${invitationToken}`;
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, inviteLink };
  }

  /**
   * Regenerate invite token for an existing partner (store owner / rider) whose link expired.
   * Does NOT delete or recreate their Store or products.
   */
  async regeneratePartnerInvite(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.CUSTOMER) {
      throw new BadRequestException('Only riders/store owners can receive partner invite links');
    }
    if (user.passwordSet) {
      throw new BadRequestException('This partner already set a password. Use partner login instead.');
    }
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiresAt = new Date(Date.now() + this.inviteExpiryMs());
    await this.prisma.user.update({
      where: { id: userId },
      data: { invitationToken, invitationExpiresAt },
    });
    const inviteLink = `${this.inviteBaseUrl()}/partner-invite?token=${invitationToken}`;
    return { inviteLink, invitationExpiresAt };
  }

  /**
   * For STORE_OWNER users created before stores were auto-created, or if creation failed.
   */
  async bootstrapStoreForPartnerUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== Role.STORE_OWNER) {
      throw new BadRequestException('User is not a store owner');
    }
    const existing = await this.prisma.store.findFirst({ where: { ownerId: userId } });
    if (existing) {
      return { store: existing, created: false };
    }
    const store = await this.prisma.store.create({
      data: {
        ownerId: userId,
        name: `${user.name.trim()}'s store`,
        city: 'Lahore',
        phone: user.phone,
        status: user.passwordSet ? StoreStatus.ACTIVE : StoreStatus.INVITED,
        isApproved: true,
        isOpen: true,
      },
    });
    await this.stores.invalidatePublicStoreListCache().catch(() => undefined);
    return { store, created: true };
  }

  async listPartners() {
    const users = await this.prisma.user.findMany({
      where: { role: { in: [Role.RIDER, Role.STORE_OWNER] } },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, passwordSet: true, createdAt: true, invitationExpiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  async getMetrics() {
    const ttl = this.adminMetricsTtlSeconds();
    return this.upstash.wrapJson('admin:metrics:v1', ttl, () => this.computeMetrics());
  }

  private async computeMetrics() {
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

  /** In-flight pipeline orders (not delivered / cancelled) for ops visibility. */
  async getLiveOrders() {
    const liveStatuses = [
      'PENDING',
      'STORE_ACCEPTED',
      'READY_FOR_PICKUP',
      'RIDER_ASSIGNED',
      'RIDER_ACCEPTED',
      'PICKED_UP',
    ] as const;
    const rows = await this.prisma.order.findMany({
      where: { orderStatus: { in: [...liveStatuses] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        createdAt: true,
        totalAmount: true,
        paymentMethod: true,
        store: { select: { id: true, name: true } },
        customer: { select: { name: true, phone: true } },
        address: { select: { fullAddress: true, city: true } },
      },
    });
    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderStatus: o.orderStatus,
      createdAt: o.createdAt,
      totalAmount: Number(o.totalAmount),
      paymentMethod: o.paymentMethod,
      store: o.store,
      customer: o.customer,
      address: o.address,
    }));
  }

  /** Same pipeline definition as live list — for header badge / real-time counter. */
  async getLiveOrderCount() {
    const liveStatuses = [
      'PENDING',
      'STORE_ACCEPTED',
      'READY_FOR_PICKUP',
      'RIDER_ASSIGNED',
      'RIDER_ACCEPTED',
      'PICKED_UP',
    ] as const;
    const count = await this.prisma.order.count({
      where: { orderStatus: { in: [...liveStatuses] } },
    });
    return { count };
  }

  private async getStoresClosedDuringHours(): Promise<{ id: string; name: string }[]> {
    const stores = await this.prisma.store.findMany({
      where: { isApproved: true, isOpen: false, openingTime: { not: null }, closingTime: { not: null } },
      select: { id: true, name: true, openingTime: true, closingTime: true },
    });
    const tz = this.config.get<string>('BUSINESS_TIMEZONE', 'Asia/Karachi');
    const now = new Date();
    const nowMins = getWallClockMinutesInTimeZone(now, tz);
    return stores
      .filter((s) => {
        if (!s.openingTime || !s.closingTime) return false;
        return isWithinBusinessWindow(s.openingTime, s.closingTime, nowMins);
      })
      .map((s) => ({ id: s.id, name: s.name }));
  }

  /**
   * @param platform Optional slug: `food` | `grocery` | `medicine` — only stores linked to that platform tab.
   * @param includeUnapproved When true (e.g. bulk import tooling), include stores not yet approved.
   */
  async getStores(platform?: string, includeUnapproved = false) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const where: Prisma.StoreWhereInput = {};
    if (!includeUnapproved) {
      where.isApproved = true;
    }
    if (platform?.trim()) {
      const slug = platform.trim().toLowerCase();
      const title = slug.charAt(0).toUpperCase() + slug.slice(1);
      const nameVariants = [...new Set([slug, title])];
      where.categories = {
        some: { category: { name: { in: nameVariants } } },
      };
    }
    const stores = await this.prisma.store.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        categories: { include: { category: { select: { name: true } } } },
        orders: { where: { createdAt: { gte: todayStart } }, select: { id: true, totalAmount: true, orderStatus: true } },
        earnings: { where: { createdAt: { gte: todayStart } }, select: { commissionAmount: true, storeAmount: true } },
      },
    });
    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      isOpen: s.isOpen,
      status: s.status,
      openingTime: s.openingTime,
      closingTime: s.closingTime,
      ordersToday: s.orders.length,
      revenueToday: s.orders.filter((o) => o.orderStatus === 'DELIVERED').reduce((sum, o) => sum + Number(o.totalAmount), 0),
      isApproved: s.isApproved,
      commissionPercentOverride:
        s.commissionPercentOverride != null ? Number(s.commissionPercentOverride) : null,
      platformCategories: s.categories.map((c) => c.category.name),
    }));
  }

  async setStoreStatus(storeId: string, status: StoreStatus) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { status },
      select: { id: true, status: true },
    });
    await this.stores.invalidatePublicStoreListCache().catch(() => undefined);
    return updated;
  }

  /** Platform verticals (Food / Grocery / Medicine tabs on customer app). */
  async getStorePlatformCategories(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { categories: { include: { category: { select: { name: true } } } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    return { names: store.categories.map((c) => c.category.name) };
  }

  async setStorePlatformCategories(storeId: string, names: string[]) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    const slug = /^[a-z0-9_-]+$/;
    const normalized = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
    for (const n of normalized) {
      if (!slug.test(n)) {
        throw new BadRequestException(
          `Invalid category slug "${n}". Use lowercase letters, numbers, hyphen, underscore (e.g. food, grocery, medicine).`,
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.storeToCategory.deleteMany({ where: { storeId } });
      for (const name of normalized) {
        const cat = await tx.storeCategory.upsert({
          where: { name },
          create: { name },
          update: {},
        });
        await tx.storeToCategory.create({ data: { storeId, categoryId: cat.id } });
      }
    });
    await this.stores.invalidatePublicStoreListCache().catch(() => undefined);
    return this.getStorePlatformCategories(storeId);
  }

  private mapRiderUserToAdminListRow(
    r: Prisma.UserGetPayload<{
      include: {
        riderProfile: true;
        ordersAsRider: { include: { statusHistory: true } };
        riderEarnings: true;
      };
    }>,
    todayStart: Date,
  ) {
    const todayOrders = r.ordersAsRider.filter((o) => new Date(o.createdAt) >= todayStart);
    const delivered = r.ordersAsRider.filter((o) => o.orderStatus === 'DELIVERED');
    let avgDeliveryMins = 0;
    delivered.forEach((o) => {
      const ready = o.statusHistory.find(
        (h) => h.status === 'READY_FOR_PICKUP' || h.status === 'RIDER_ASSIGNED',
      )?.createdAt;
      const deliv = o.statusHistory.find((h) => h.status === 'DELIVERED')?.createdAt;
      if (ready && deliv) avgDeliveryMins += (new Date(deliv).getTime() - new Date(ready).getTime()) / 60000;
    });
    if (delivered.length > 0) avgDeliveryMins /= delivered.length;
    const assigned = r.ordersAsRider.filter((o) => o.orderStatus === 'RIDER_ASSIGNED').length;
    const accepted = r.ordersAsRider.filter((o) => o.orderStatus !== 'RIDER_ASSIGNED').length;
    const acceptanceRate =
      assigned + accepted > 0 ? ((accepted / (assigned + accepted)) * 100).toFixed(0) : '0';
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
      codCollectedAmount: Number(r.riderProfile?.currentCollectedAmount ?? 0),
      codBlocked: r.riderProfile?.isBlocked ?? false,
    };
  }

  private readonly riderAdminInclude = {
    riderProfile: true,
    ordersAsRider: { include: { statusHistory: true } },
    riderEarnings: true,
  } satisfies Prisma.UserInclude;

  async getRiders() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const riders = await this.prisma.user.findMany({
      where: { role: Role.RIDER },
      include: this.riderAdminInclude,
    });
    return riders.map((r) => this.mapRiderUserToAdminListRow(r, todayStart));
  }

  /** Single rider — same stats as list plus profile, location, vehicle, COD limit. */
  async getRiderById(riderId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const r = await this.prisma.user.findFirst({
      where: { id: riderId, role: Role.RIDER },
      include: this.riderAdminInclude,
    });
    if (!r) throw new NotFoundException('Rider not found');
    const row = this.mapRiderUserToAdminListRow(r, todayStart);
    const collected = Number(r.riderProfile?.currentCollectedAmount ?? 0);
    return {
      ...row,
      email: r.email,
      memberSince: r.createdAt.toISOString(),
      vehicleType: r.riderProfile?.vehicleType ?? null,
      vehicleNumber: r.riderProfile?.vehicleNumber ?? null,
      isAvailable: r.riderProfile?.isAvailable ?? false,
      currentLatitude: r.riderProfile?.currentLatitude != null ? Number(r.riderProfile.currentLatitude) : null,
      currentLongitude: r.riderProfile?.currentLongitude != null ? Number(r.riderProfile.currentLongitude) : null,
      profileUpdatedAt: r.riderProfile?.updatedAt?.toISOString() ?? null,
      codLimitPkr: RIDER_COD_COLLECTION_LIMIT_PKR,
      remainingCodUntilLimit: Math.max(0, RIDER_COD_COLLECTION_LIMIT_PKR - collected),
    };
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
        riderCost: Number(monthRiderCost._sum.earningAmount ?? 0),
        cancellationLoss: Number(cancelledMonthValue._sum.subtotalAmount ?? 0),
        cancelledOrders: cancelledMonth,
      },
    };
  }

  async listPlatformCategoryCommissions() {
    return this.prisma.platformCategoryCommission.findMany({
      orderBy: { categorySlug: 'asc' },
    });
  }

  async getPlatformCheckoutSettings() {
    const row = await this.prisma.platformCheckoutSettings.findUnique({ where: { id: 'default' } });
    if (row) return row;
    return this.prisma.platformCheckoutSettings.create({
      data: {
        id: 'default',
        serviceFeeMode: CheckoutServiceFeeMode.FIXED,
        serviceFeeFixed: 19.99,
        serviceFeePercent: 0,
        codTaxPercent: 0,
        codTaxEnabled: false,
        deliveryBasePerKm: 45,
        weekendMultiplier: 1,
        peakMultiplier: 1,
        peakStartTime: '18:00',
        peakEndTime: '22:00',
      },
    });
  }

  async patchPlatformCheckoutSettings(dto: PatchPlatformCheckoutSettingsDto) {
    await this.getPlatformCheckoutSettings();
    const data: {
      serviceFeeMode?: CheckoutServiceFeeMode;
      serviceFeeFixed?: number;
      serviceFeePercent?: number;
      codTaxPercent?: number;
      codTaxEnabled?: boolean;
      deliveryBasePerKm?: number;
      weekendMultiplier?: number;
      peakMultiplier?: number;
      peakStartTime?: string;
      peakEndTime?: string;
    } = {};
    if (dto.serviceFeeMode !== undefined) data.serviceFeeMode = dto.serviceFeeMode;
    if (dto.serviceFeeFixed !== undefined) data.serviceFeeFixed = dto.serviceFeeFixed;
    if (dto.serviceFeePercent !== undefined) data.serviceFeePercent = dto.serviceFeePercent;
    if (dto.codTaxPercent !== undefined) data.codTaxPercent = dto.codTaxPercent;
    if (dto.codTaxEnabled !== undefined) data.codTaxEnabled = dto.codTaxEnabled;
    if (dto.deliveryBasePerKm !== undefined) data.deliveryBasePerKm = dto.deliveryBasePerKm;
    if (dto.weekendMultiplier !== undefined) data.weekendMultiplier = dto.weekendMultiplier;
    if (dto.peakMultiplier !== undefined) data.peakMultiplier = dto.peakMultiplier;
    if (dto.peakStartTime !== undefined) data.peakStartTime = dto.peakStartTime;
    if (dto.peakEndTime !== undefined) data.peakEndTime = dto.peakEndTime;
    if (Object.keys(data).length === 0) {
      return this.prisma.platformCheckoutSettings.findUniqueOrThrow({ where: { id: 'default' } });
    }
    return this.prisma.platformCheckoutSettings.update({
      where: { id: 'default' },
      data,
    });
  }

  async upsertPlatformCategoryCommission(categorySlug: string, commissionPercent: number) {
    const slug = categorySlug.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      throw new BadRequestException('Invalid category slug');
    }
    return this.prisma.platformCategoryCommission.upsert({
      where: { categorySlug: slug },
      create: { categorySlug: slug, commissionPercent },
      update: { commissionPercent },
    });
  }

  async setStoreCommissionOverride(storeId: string, commissionPercentOverride: number | null) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    return this.prisma.store.update({
      where: { id: storeId },
      data: { commissionPercentOverride },
      select: { id: true, name: true, commissionPercentOverride: true },
    });
  }

  /** Read-only: manual online payment verify actions (see `orders.service` verify step). */
  async listManualPaymentAuditLogs(options: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const offset = Math.max(Number(options.offset) || 0, 0);
    const where: Prisma.AdminLogWhereInput = {
      action: { in: ['MANUAL_PAYMENT_APPROVE', 'MANUAL_PAYMENT_REJECT'] },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          admin: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.adminLog.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  async getMetricsCharts() {
    const ttl = this.adminChartsTtlSeconds();
    return this.upstash.wrapJson('admin:metrics:charts:v1', ttl, () => this.computeMetricsCharts());
  }

  private async computeMetricsCharts() {
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
