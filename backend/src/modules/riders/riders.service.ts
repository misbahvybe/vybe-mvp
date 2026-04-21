import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WithdrawService } from '../withdraw/withdraw.service';
import { haversineDistanceKm } from '../../common/geo/haversine';
import { OrdersGateway } from '../realtime/orders.gateway';
import { NotificationsService } from '../notifications/notifications.service';
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

const EARLY_OFFER_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.STORE_ACCEPTED];

const ACTIVE_RIDER_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.STORE_ACCEPTED,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.RIDER_ACCEPTED,
  OrderStatus.PICKED_UP,
];

@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly withdraw: WithdrawService,
    private readonly ordersGateway: OrdersGateway,
    private readonly notifications: NotificationsService,
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
   * Orders still at the restaurant (pre-ready) with no captain yet — first nearby rider to accept is reserved.
   */
  async findEarlyOffersNear(riderId: string, latStr?: string, lngStr?: string) {
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
    const hasCoords = lat != null && lng != null;
    const deltaLat = radiusKm / 111;
    const cos = hasCoords ? Math.cos((Number(lat) * Math.PI) / 180) : 1;
    const deltaLng = radiusKm / (111 * Math.max(0.2, cos));

    const orders = await this.prisma.order.findMany({
      where: {
        orderStatus: { in: [OrderStatus.PENDING, OrderStatus.STORE_ACCEPTED] },
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
        offerKind: 'EARLY' as const,
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
        offerKind: 'PICKUP' as const,
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

  /**
   * Merged list: early delivery offers (order just placed / preparing) + classic ready-for-pickup pool.
   */
  async findAvailableOrdersMerged(riderId: string, latStr?: string, lngStr?: string) {
    const [early, pickup] = await Promise.all([
      this.findEarlyOffersNear(riderId, latStr, lngStr),
      this.findAvailableOrdersNear(riderId, latStr, lngStr),
    ]);
    return [...early, ...pickup];
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

  /**
   * Find online nearby riders (within 2km) for a pickup and ping them via realtime.
   * This does not assign the order; it just makes the offer appear instantly.
   */
  async notifyNearbyRidersForPickup(orderId: string): Promise<{ notified: number }> {
    const nearby = await this.findNearbyRidersForPickup(orderId);
    for (const r of nearby) {
      this.ordersGateway.emitPickupNew(r.riderId, {
        orderId,
        storeId: r.storeId,
        at: new Date().toISOString(),
        distanceKm: r.distanceKm,
      });
    }
    return { notified: nearby.length };
  }

  /**
   * Returns nearby available riders for a pickup order, sorted by distance.
   * Used both for "offer broadcast" and for "auto-assign nearest rider".
   */
  async findNearbyRidersForPickup(orderId: string): Promise<{ riderId: string; distanceKm: number; storeId: string }[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, latitude: true, longitude: true } },
        address: { select: { latitude: true, longitude: true } },
      },
    });
    if (!order) return [];
    if (order.orderStatus !== OrderStatus.READY_FOR_PICKUP || order.riderId) return [];

    const ref = pickRefLatLng(order.store, order.address);
    if (!ref) return [];

    const radiusKm = RIDER_NEARBY_ORDER_RADIUS_KM;
    const deltaLat = radiusKm / 111;
    const cos = Math.cos((ref.lat * Math.PI) / 180);
    const deltaLng = radiusKm / (111 * Math.max(0.2, cos));

    const candidates = await this.prisma.riderProfile.findMany({
      where: {
        isAvailable: true,
        isBlocked: false,
        currentLatitude: { not: null, gte: new Decimal(ref.lat - deltaLat), lte: new Decimal(ref.lat + deltaLat) },
        currentLongitude: { not: null, gte: new Decimal(ref.lng - deltaLng), lte: new Decimal(ref.lng + deltaLng) },
      },
      select: { userId: true, currentLatitude: true, currentLongitude: true, currentCollectedAmount: true },
      take: 150,
    });

    const rows: { riderId: string; distanceKm: number; storeId: string }[] = [];
    for (const c of candidates) {
      const collected = Number(c.currentCollectedAmount ?? 0);
      if (collected >= RIDER_COD_COLLECTION_LIMIT_PKR) continue;
      const lat = c.currentLatitude != null ? Number(c.currentLatitude) : null;
      const lng = c.currentLongitude != null ? Number(c.currentLongitude) : null;
      if (lat == null || lng == null) continue;
      const d = haversineDistanceKm(lat, lng, ref.lat, ref.lng);
      if (d > radiusKm) continue;
      rows.push({ riderId: c.userId, distanceKm: Math.round(d * 100) / 100, storeId: order.store.id });
    }

    rows.sort((a, b) => a.distanceKm - b.distanceKm);
    return rows;
  }

  /**
   * Same geo as pickup matching, but for orders still in the kitchen queue (no rider yet).
   */
  async findNearbyRidersForEarlyOffer(orderId: string): Promise<{ riderId: string; distanceKm: number; storeId: string }[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, latitude: true, longitude: true } },
        address: { select: { latitude: true, longitude: true } },
      },
    });
    if (!order) return [];
    if (order.riderId) return [];
    if (!EARLY_OFFER_STATUSES.includes(order.orderStatus)) return [];

    const ref = pickRefLatLng(order.store, order.address);
    if (!ref) return [];

    const radiusKm = RIDER_NEARBY_ORDER_RADIUS_KM;
    const deltaLat = radiusKm / 111;
    const cos = Math.cos((ref.lat * Math.PI) / 180);
    const deltaLng = radiusKm / (111 * Math.max(0.2, cos));

    const candidates = await this.prisma.riderProfile.findMany({
      where: {
        isAvailable: true,
        isBlocked: false,
        currentLatitude: { not: null, gte: new Decimal(ref.lat - deltaLat), lte: new Decimal(ref.lat + deltaLat) },
        currentLongitude: { not: null, gte: new Decimal(ref.lng - deltaLng), lte: new Decimal(ref.lng + deltaLng) },
      },
      select: { userId: true, currentLatitude: true, currentLongitude: true, currentCollectedAmount: true },
      take: 150,
    });

    const rows: { riderId: string; distanceKm: number; storeId: string }[] = [];
    for (const c of candidates) {
      const collected = Number(c.currentCollectedAmount ?? 0);
      if (collected >= RIDER_COD_COLLECTION_LIMIT_PKR) continue;
      const lat = c.currentLatitude != null ? Number(c.currentLatitude) : null;
      const lng = c.currentLongitude != null ? Number(c.currentLongitude) : null;
      if (lat == null || lng == null) continue;
      const d = haversineDistanceKm(lat, lng, ref.lat, ref.lng);
      if (d > radiusKm) continue;
      rows.push({ riderId: c.userId, distanceKm: Math.round(d * 100) / 100, storeId: order.store.id });
    }

    rows.sort((a, b) => a.distanceKm - b.distanceKm);
    return rows;
  }

  /** Call right after a customer order is created (same realtime path as store). */
  async notifyNearbyRidersForNewOrder(orderId: string): Promise<{ notified: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true } },
        customer: { select: { name: true, phone: true } },
      },
    });
    if (!order || order.riderId) return { notified: 0 };
    if (!EARLY_OFFER_STATUSES.includes(order.orderStatus)) return { notified: 0 };

    const nearby = await this.findNearbyRidersForEarlyOffer(orderId);
    for (const r of nearby) {
      this.ordersGateway.emitOrderOfferToRider(r.riderId, {
        orderId: order.id,
        storeId: order.storeId,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt.toISOString(),
        totalAmount: order.totalAmount.toString(),
        distanceKm: r.distanceKm,
        customer: {
          name: order.customer?.name ?? '',
          phone: order.customer?.phone ?? '',
        },
      });
    }
    this.ordersGateway.emitPickupPoolUpdated();
    return { notified: nearby.length };
  }

  async assertRiderCanAcceptEarlyOffer(riderId: string, orderId: string): Promise<void> {
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
      Number(profile.currentCollectedAmount ?? 0) >= RIDER_COD_COLLECTION_LIMIT_PKR
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
    if (!EARLY_OFFER_STATUSES.includes(order.orderStatus) || order.riderId) {
      throw new BadRequestException('Order is no longer available for early assignment');
    }
    const lat = profile.currentLatitude != null ? Number(profile.currentLatitude) : null;
    const lng = profile.currentLongitude != null ? Number(profile.currentLongitude) : null;
    if (lat == null || lng == null) {
      throw new BadRequestException('Set your location first (GPS) to accept orders within range.');
    }
    const ref = pickRefLatLng(order.store, order.address);
    if (!ref) {
      throw new BadRequestException('Pickup location unavailable for distance check.');
    }
    const d = haversineDistanceKm(lat, lng, ref.lat, ref.lng);
    if (d > RIDER_NEARBY_ORDER_RADIUS_KM) {
      throw new BadRequestException(
        `You must be within ${RIDER_NEARBY_ORDER_RADIUS_KM} km of the pickup to accept this order.`,
      );
    }
  }

  /**
   * First rider wins (atomic update). Restaurant keeps preparing; captain is reserved for delivery.
   */
  async acceptEarlyDeliveryOffer(riderId: string, orderId: string) {
    await this.assertRiderCanAcceptEarlyOffer(riderId, orderId);
    const busy = await this.prisma.order.count({
      where: {
        riderId,
        orderStatus: { in: ACTIVE_RIDER_ORDER_STATUSES },
      },
    });
    if (busy > 0) {
      throw new BadRequestException('Finish or release your current order before accepting another.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: {
          id: orderId,
          riderId: null,
          orderStatus: { in: [OrderStatus.PENDING, OrderStatus.STORE_ACCEPTED] },
        },
        data: { riderId },
      });
      if (res.count === 0) {
        throw new BadRequestException('Order is no longer available');
      }
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          store: { select: { id: true, name: true, ownerId: true } },
          address: true,
          customer: { select: { name: true, phone: true } },
          items: { include: { product: true } },
        },
      });
    });

    const ownerId = updated.store?.ownerId;
    if (ownerId) {
      await this.notifications.create({
        userId: ownerId,
        type: 'RIDER_RESERVED',
        title: `Captain reserved for order (#${(updated as { orderNumber?: number }).orderNumber ?? updated.id.slice(-8)})`,
        body: 'A rider accepted early — they will head to you when the order is ready.',
        data: { orderId: updated.id, storeId: updated.storeId, riderId },
      });
    }

    this.ordersGateway.emitOrderOfferResolved(orderId, riderId);
    this.ordersGateway.emitOrderUpdated(
      {
        orderId: updated.id,
        orderStatus: updated.orderStatus,
        storeId: updated.storeId,
        customerId: updated.customerId,
        riderId,
      },
      null,
    );
    this.ordersGateway.emitPickupPoolUpdated();
    this.ordersGateway.emitAdminPipelineUpdated();
    this.ordersGateway.emitRiderAssigned(riderId, updated.id);

    return updated;
  }
}
