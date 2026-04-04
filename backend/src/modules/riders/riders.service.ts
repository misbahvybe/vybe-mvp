import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { haversineDistanceKm } from '../../common/geo/haversine';

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
  constructor(private readonly prisma: PrismaService) {}

  /** Every rider endpoint should tolerate missing profile (legacy / race on first login). */
  private async ensureRiderProfile(riderId: string) {
    await this.prisma.riderProfile.upsert({
      where: { userId: riderId },
      update: {},
      create: { userId: riderId, isAvailable: true },
    });
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
    await this.ensureRiderProfile(riderId);
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

  /**
   * Open pickup pool: READY_FOR_PICKUP, no rider. Sorted by distance to rider when lat/lng known
   * (query params or last PATCH /riders/me/location). Otherwise oldest first.
   */
  async findAvailableOrdersNear(riderId: string, latStr?: string, lngStr?: string) {
    await this.ensureRiderProfile(riderId);
    let lat = parseCoord(latStr);
    let lng = parseCoord(lngStr);
    if (lat == null || lng == null) {
      const profile = await this.prisma.riderProfile.findUnique({
        where: { userId: riderId },
        select: { currentLatitude: true, currentLongitude: true },
      });
      if (profile?.currentLatitude != null && profile?.currentLongitude != null) {
        lat = Number(profile.currentLatitude);
        lng = Number(profile.currentLongitude);
      }
    }

    const orders = await this.prisma.order.findMany({
      where: {
        orderStatus: OrderStatus.READY_FOR_PICKUP,
        riderId: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
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

    if (lat != null && lng != null) {
      rows.sort((a, b) => {
        const da = a.distanceKm ?? 1e9;
        const db = b.distanceKm ?? 1e9;
        return da - db;
      });
    }

    return rows;
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
