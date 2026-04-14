import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WithdrawService } from '../withdraw/withdraw.service';
import { haversineDistanceKm } from '../../common/geo/haversine';
import { OrdersGateway } from '../realtime/orders.gateway';
import {
  RIDER_COD_COLLECTION_LIMIT_PKR,
  RIDER_NEARBY_ORDER_RADIUS_KM,
} from '../../common/constants/rider-cod';

function parseCoord(v: string | undefined): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickRefLatLng(
  store: { latitude: unknown; longitude: unknown },
  address: { latitude: unknown; longitude: unknown },
): { lat: number; lng: number } | null {
  const sLat = store.latitude != null ? Number(store.latitude) : NaN;
  const sLng = store.longitude != null ? Number(store.longitude) : NaN;
  if (Number.isFinite(sLat) && Number.isFinite(sLng)) {
    return { lat: sLat, lng: sLng };
  }
  const aLat = Number(address.latitude);
  const aLng = Number(address.longitude);
  if (Number.isFinite(aLat) && Number.isFinite(aLng)) {
    return { lat: aLat, lng: aLng };
  }
  return null;
}

@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly withdraw: WithdrawService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  /** Every rider endpoint should tolerate missing profile (legacy / race on first login). */
  private async ensureRiderProfile(riderId: string) {
    await this.prisma.riderProfile.upsert({
      where: { userId: riderId },
      update: {},
      create: { userId: riderId, isAvailable: true },
    });
  }

  private async ensureRiderProfileTx(tx: Prisma.TransactionClient, riderId: string) {
    await tx.riderProfile.upsert({
      where: { userId: riderId },
      update: {},
      create: { userId: riderId, isAvailable: true },
    });
  }

  /** Add COD cash to rider balance when delivery completes (inside order transaction). */
  async applyCodOnDelivered(
    tx: Prisma.TransactionClient,
    params: { riderId: string; paymentMethod: PaymentMethod; totalAmount: Decimal },
  ): Promise<void> {
    if (params.paymentMethod !== PaymentMethod.COD) return;
    await this.ensureRiderProfileTx(tx, params.riderId);
    const updated = await tx.riderProfile.update({
      where: { userId: params.riderId },
      data: {
        currentCollectedAmount: { increment: params.totalAmount },
      },
      select: { currentCollectedAmount: true },
    });
    const total = Number(updated.currentCollectedAmount);
    if (total >= RIDER_COD_COLLECTION_LIMIT_PKR) {
      await tx.riderProfile.update({
        where: { userId: params.riderId },
        data: { isBlocked: true },
      });
    }
  }

  /** Server-side guard: blocked riders or riders outside 2 km cannot self-claim from pool. */
  async assertRiderCanSelfClaimPickup(riderId: string, orderId: string): Promise<void> {
    await this.ensureRiderProfile(riderId);
    const profile = await this.prisma.riderProfile.findUniqueOrThrow({
      where: { userId: riderId },
      select: {
        isBlocked: true,
        currentLatitude: true,
        currentLongitude: true,
        currentCollectedAmount: true,
      },
    });
    if (
      profile.isBlocked ||
      Number(profile.currentCollectedAmount) >= RIDER_COD_COLLECTION_LIMIT_PKR
    ) {
      throw new BadRequestException(
        'Cash collection limit reached. Deposit with admin before accepting new pickups.',
      );
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { latitude: true, longitude: true } },
        address: { select: { latitude: true, longitude: true } },
      },
    });
    if (!order) throw new BadRequestException('Order not found');
    const lat =
      profile.currentLatitude != null ? Number(profile.currentLatitude) : null;
    const lng =
      profile.currentLongitude != null ? Number(profile.currentLongitude) : null;
    if (lat == null || lng == null) {
      throw new BadRequestException(
        'Set your location first (GPS) to pick orders within range.',
      );
    }
    const ref = pickRefLatLng(order.store, order.address);
    if (!ref) {
      throw new BadRequestException('Pickup location unavailable for distance check.');
    }
    const d = haversineDistanceKm(lat, lng, ref.lat, ref.lng);
    if (d > RIDER_NEARBY_ORDER_RADIUS_KM) {
      throw new BadRequestException(
        `You must be within ${RIDER_NEARBY_ORDER_RADIUS_KM} km of the pickup to claim this order.`,
      );
    }
  }

  /** Admin assignment or pool reassignment — blocked riders must not receive new pickups. */
  async assertRiderNotBlockedForNewPickup(riderId: string): Promise<void> {
    await this.ensureRiderProfile(riderId);
    const p = await this.prisma.riderProfile.findUnique({
      where: { userId: riderId },
      select: { isBlocked: true, currentCollectedAmount: true },
    });
    if (
      p?.isBlocked ||
      (p != null && Number(p.currentCollectedAmount) >= RIDER_COD_COLLECTION_LIMIT_PKR)
    ) {
      throw new BadRequestException(
        'This rider is blocked from new pickups until COD cash is settled with admin.',
      );
    }
  }

  async emitCodWalletSnapshotForRider(riderId: string): Promise<void> {
    const p = await this.prisma.riderProfile.findUnique({
      where: { userId: riderId },
      select: { currentCollectedAmount: true, isBlocked: true },
    });
    if (!p) return;
    this.ordersGateway.emitRiderCodWalletUpdated(riderId, {
      currentCollectedAmount: Number(p.currentCollectedAmount),
      isBlocked: p.isBlocked,
      codLimitPkr: RIDER_COD_COLLECTION_LIMIT_PKR,
    });
  }

  async resetCodBalanceAfterSettlement(adminId: string, riderId: string) {
    const rider = await this.prisma.user.findFirst({
      where: { id: riderId, role: Role.RIDER },
      select: { id: true },
    });
    if (!rider) throw new BadRequestException('Rider not found');
    await this.ensureRiderProfile(riderId);
    const before = await this.prisma.riderProfile.findUnique({
      where: { userId: riderId },
      select: { currentCollectedAmount: true },
    });
    const settled = Number(before?.currentCollectedAmount ?? 0);
    await this.prisma.$transaction([
      this.prisma.riderProfile.update({
        where: { userId: riderId },
        data: { currentCollectedAmount: 0, isBlocked: false },
      }),
      this.prisma.adminLog.create({
        data: {
          adminId,
          action: `RIDER_COD_SETTLED:${settled}`,
          targetId: riderId,
        },
      }),
    ]);
    this.ordersGateway.emitRiderCodWalletUpdated(riderId, {
      currentCollectedAmount: 0,
      isBlocked: false,
      codLimitPkr: RIDER_COD_COLLECTION_LIMIT_PKR,
    });
    return { ok: true as const, settledAmount: settled };
  }

  async getDashboard(riderId: string) {
    await this.ensureRiderProfile(riderId);
    const profile = await this.prisma.riderProfile.findUniqueOrThrow({
      where: { userId: riderId },
    });
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
    const collected = Number(profile.currentCollectedAmount);
    const isBlocked = profile.isBlocked || collected >= RIDER_COD_COLLECTION_LIMIT_PKR;
    return {
      isAvailable: profile.isAvailable,
      todayEarnings,
      completedToday: completedCount,
      cod: {
        currentCollectedAmount: collected,
        limitPkr: RIDER_COD_COLLECTION_LIMIT_PKR,
        remainingUntilLimit: Math.max(0, RIDER_COD_COLLECTION_LIMIT_PKR - collected),
        isBlocked,
        warningMessage: isBlocked
          ? 'You must deposit cash with admin to continue receiving orders.'
          : null,
      },
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
    await this.ensureRiderProfile(riderId);
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const [todayAgg, weekAgg, totalAgg, history, balance, payoutHistory] = await Promise.all([
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
      this.withdraw.getRiderFinancialSnapshot(riderId),
      this.prisma.earningPayout.findMany({
        where: { userId: riderId, role: Role.RIDER },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          amountPkr: true,
          createdAt: true,
          withdrawRequestId: true,
        },
      }),
    ]);
    return {
      today: { amount: Number(todayAgg._sum.earningAmount ?? 0), count: todayAgg._count },
      week: { amount: Number(weekAgg._sum.earningAmount ?? 0), count: weekAgg._count },
      total: { amount: Number(totalAgg._sum.earningAmount ?? 0), count: totalAgg._count },
      balance,
      history: history.map((e) => ({
        kind: 'order' as const,
        orderId: e.orderId,
        createdAt: e.order.createdAt,
        amount: Number(e.earningAmount),
      })),
      payoutHistory: payoutHistory.map((p) => ({
        kind: 'payout' as const,
        id: p.id,
        withdrawRequestId: p.withdrawRequestId,
        createdAt: p.createdAt,
        amount: Number(p.amountPkr),
      })),
    };
  }

  /**
   * Open pickup pool: READY_FOR_PICKUP, no rider. Sorted by distance when coords known.
   * Only orders within {@link RIDER_NEARBY_ORDER_RADIUS_KM} km; blocked riders see none.
   */
  async findAvailableOrdersNear(riderId: string, latStr?: string, lngStr?: string) {
    await this.ensureRiderProfile(riderId);
    const riderProf = await this.prisma.riderProfile.findUnique({
      where: { userId: riderId },
      select: {
        isBlocked: true,
        currentCollectedAmount: true,
        currentLatitude: true,
        currentLongitude: true,
      },
    });
    if (
      riderProf?.isBlocked ||
      (riderProf != null && Number(riderProf.currentCollectedAmount) >= RIDER_COD_COLLECTION_LIMIT_PKR)
    ) {
      return [];
    }

    let lat = parseCoord(latStr);
    let lng = parseCoord(lngStr);
    if (lat == null || lng == null) {
      if (riderProf?.currentLatitude != null && riderProf?.currentLongitude != null) {
        lat = Number(riderProf.currentLatitude);
        lng = Number(riderProf.currentLongitude);
      }
    }

    const radiusKm = RIDER_NEARBY_ORDER_RADIUS_KM;
    // Performance: bounding-box filter by store coords first (DB), then haversine.
    const hasCoords = lat != null && lng != null;
    const deltaLat = radiusKm / 111;
    const cos = hasCoords ? Math.cos((Number(lat) * Math.PI) / 180) : 1;
    const deltaLng = radiusKm / (111 * Math.max(0.2, cos));

    const orders = await this.prisma.order.findMany({
      where: {
        orderStatus: OrderStatus.READY_FOR_PICKUP,
        riderId: null,
        ...(hasCoords
          ? {
              store: {
                latitude: { not: null, gte: new Decimal(Number(lat) - deltaLat), lte: new Decimal(Number(lat) + deltaLat) },
                longitude: { not: null, gte: new Decimal(Number(lng) - deltaLng), lte: new Decimal(Number(lng) + deltaLng) },
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 80,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            phone: true,
          },
        },
        address: true,
        customer: { select: { name: true, phone: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });

    const rows = orders.map((o) => {
      const ref = pickRefLatLng(o.store, o.address);
      let distanceKm: number | null = null;
      if (lat != null && lng != null && ref) {
        distanceKm = Math.round(haversineDistanceKm(lat, lng, ref.lat, ref.lng) * 100) / 100;
      }
      return {
        id: o.id,
        orderStatus: o.orderStatus,
        createdAt: o.createdAt,
        totalAmount: Number(o.totalAmount),
        paymentMethod: o.paymentMethod,
        deliveryFee: Number(o.deliveryFee),
        distanceKm,
        store: o.store,
        address: o.address,
        customer: o.customer,
        items: o.items,
      };
    });

    const inRange = rows.filter((r) => {
      if (r.distanceKm == null) return false;
      return r.distanceKm <= radiusKm;
    });

    if (lat != null && lng != null) {
      inRange.sort((a, b) => {
        const da = a.distanceKm ?? 1e9;
        const db = b.distanceKm ?? 1e9;
        return da - db;
      });
    }

    return inRange;
  }

  async updateLocation(riderId: string, latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Invalid coordinates');
    }
    await this.ensureRiderProfile(riderId);
    await this.prisma.riderProfile.update({
      where: { userId: riderId },
      data: { currentLatitude: latitude, currentLongitude: longitude },
    });
    return { ok: true as const };
  }
}
