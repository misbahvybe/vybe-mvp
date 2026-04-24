import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { haversineDistanceKm } from '../../common/geo/haversine';
import { CheckoutServiceFeeMode, PaymentMethod } from '@prisma/client';

export type OrderQuotePayment = 'COD' | 'CARD' | 'MANUAL';

export interface OrderPricingQuote {
  subtotal: Decimal;
  deliveryDistanceKm: Decimal;
  /** Net delivery charged (after first-N-orders discount, if any). */
  deliveryFee: Decimal;
  /** Full distance-based fee before promo (equals `deliveryFee` when no waiver). */
  deliveryFeeGross: Decimal;
  /** Amount waived (e.g. first 2 orders free delivery). */
  deliveryDiscount: Decimal;
  serviceFee: Decimal;
  baseBeforeSurcharge: Decimal;
  gstAmount: Decimal;
  cardProcessingAmount: Decimal;
  totalAmount: Decimal;
  commissionPercent: Decimal;
  commissionAmount: Decimal;
  storeAmount: Decimal;
  categorySlugUsed: string | null;
  /** Whole percent shown on checkout (e.g. 16 = 16%). */
  codTaxPercent: number;
  serviceFeeMode: CheckoutServiceFeeMode;
  /** When mode is PERCENT, the configured percent of (subtotal + delivery). */
  serviceFeePercent: number;
}

type ResolvedCheckoutFees = {
  serviceFeeMode: CheckoutServiceFeeMode;
  serviceFeeFixed: number;
  serviceFeePercent: number;
  /** 0–1 fraction applied to (subtotal + delivery + service) for COD. */
  codTaxRate: number;
  codTaxEnabled: boolean;
  cardProcessingRate: number;
  deliveryPerKm: number;
};

function parseHmToMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hm ?? '').trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function pakistanNowParts(now = new Date()): { day: number; minutes: number } {
  // day: 0=Sun..6=Sat, minutes: 0..1439 (Asia/Karachi)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[wd] ?? new Date(now).getDay();
  return { day, minutes: hour * 60 + minute };
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * DB-backed checkout fees (admin). Falls back to env when row missing (e.g. before migrate).
   * COD_GST_RATE env: decimal fraction (0.16) or percent (16) — normalized to 0–1.
   */
  private async resolveCheckoutFees(): Promise<ResolvedCheckoutFees> {
    const envFee = Number(this.config.get<string>('MIN_SERVICE_FEE_PKR') ?? '19.99');
    const envCodRaw = Number(this.config.get<string>('COD_GST_RATE') ?? '0.16');
    const envCodRate = envCodRaw > 1 ? envCodRaw / 100 : envCodRaw;
    /** Off by default; set `CARD_PROCESSING_RATE` (e.g. 0.05) when you introduce GST / non-COD surcharges. */
    const cardProcessingRate = Number(this.config.get<string>('CARD_PROCESSING_RATE') ?? '0');
    const envDeliveryPerKm = Number(this.config.get<string>('DELIVERY_FEE_PER_KM') ?? '45');
    const envFallback = (): ResolvedCheckoutFees => ({
      serviceFeeMode: CheckoutServiceFeeMode.FIXED,
      serviceFeeFixed: envFee,
      serviceFeePercent: 0,
      codTaxRate: envCodRate,
      codTaxEnabled: envCodRate > 0,
      cardProcessingRate,
      deliveryPerKm: envDeliveryPerKm,
    });

    let row: Awaited<ReturnType<PrismaService['platformCheckoutSettings']['findUnique']>> = null;
    try {
      row = await this.prisma.platformCheckoutSettings.findUnique({ where: { id: 'default' } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = e instanceof PrismaClientKnownRequestError ? e.code : (e as { code?: string })?.code;
      const missingTable =
        code === 'P2021' ||
        (msg.includes('does not exist') &&
          (msg.includes('PlatformCheckoutSettings') || msg.includes('platform_checkout')));
      if (!missingTable) throw e;
      this.logger.warn(
        'platform_checkout_settings table missing — using MIN_SERVICE_FEE_PKR / COD_GST_RATE env fallback. Point DATABASE_URL at your real Neon DB and run: npx prisma migrate deploy',
      );
      return envFallback();
    }

    if (!row) {
      return envFallback();
    }
    const codPct = Number(row.codTaxPercent.toString());
    const codTaxEnabled = Boolean((row as any).codTaxEnabled ?? false);
    const deliveryBasePerKm = Number(((row as any).deliveryBasePerKm ?? envDeliveryPerKm).toString());
    const weekendMultiplier = Number(((row as any).weekendMultiplier ?? 1).toString());
    const peakMultiplier = Number(((row as any).peakMultiplier ?? 1).toString());
    const peakStart = String((row as any).peakStartTime ?? '18:00');
    const peakEnd = String((row as any).peakEndTime ?? '22:00');

    // Apply simple peak logic using Pakistan local time.
    const nowParts = pakistanNowParts();
    const isWeekend = nowParts.day === 0 || nowParts.day === 6;
    const startM = parseHmToMinutes(peakStart) ?? 18 * 60;
    const endM = parseHmToMinutes(peakEnd) ?? 22 * 60;
    const inPeak =
      endM > startM
        ? nowParts.minutes >= startM && nowParts.minutes < endM
        : nowParts.minutes >= startM || nowParts.minutes < endM; // wraps overnight
    const multiplier = Math.max(0.5, Math.min(5, (isWeekend ? weekendMultiplier : 1) * (inPeak ? peakMultiplier : 1)));
    const deliveryPerKm = Math.max(0, deliveryBasePerKm * multiplier);
    return {
      serviceFeeMode: row.serviceFeeMode,
      serviceFeeFixed: Number(row.serviceFeeFixed.toString()),
      serviceFeePercent: Number(row.serviceFeePercent.toString()),
      codTaxRate: codPct / 100,
      codTaxEnabled,
      cardProcessingRate,
      deliveryPerKm,
    };
  }

  private computeServiceFee(settings: ResolvedCheckoutFees, subtotal: Decimal, deliveryFee: Decimal): Decimal {
    if (settings.serviceFeeMode === CheckoutServiceFeeMode.PERCENT) {
      return subtotal
        .add(deliveryFee)
        .mul(settings.serviceFeePercent)
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
    return new Decimal(settings.serviceFeeFixed).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private roadDistanceFactor(): number {
    return Number(this.config.get<string>('DELIVERY_ROAD_DISTANCE_FACTOR') ?? '1.2');
  }

  private defaultCommissionPercent(): number {
    return Number(this.config.get<string>('DEFAULT_COMMISSION_PERCENT') ?? '15');
  }

  private orderSlaMinutes(): number {
    return Number(this.config.get<string>('ORDER_SLA_MINUTES') ?? '45');
  }

  slaDeadlineFromNow(): Date {
    return new Date(Date.now() + this.orderSlaMinutes() * 60 * 1000);
  }

  /**
   * Optional Google Distance Matrix (driving distance). Falls back to haversine × road factor.
   */
  async resolveDistanceKm(
    storeLat: number,
    storeLng: number,
    addrLat: number,
    addrLng: number,
  ): Promise<number> {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (key) {
      try {
        const origins = `${storeLat},${storeLng}`;
        const dest = `${addrLat},${addrLng}`;
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(dest)}&key=${key}`;
        const res = await fetch(url);
        const data = (await res.json()) as {
          rows?: { elements?: { status: string; distance?: { value: number } }[] }[];
        };
        const meters = data.rows?.[0]?.elements?.[0]?.distance?.value;
        if (typeof meters === 'number' && meters > 0) {
          return meters / 1000;
        }
      } catch {
        // fall through
      }
    }
    const straight = haversineDistanceKm(storeLat, storeLng, addrLat, addrLng);
    return Math.max(0.5, straight * this.roadDistanceFactor());
  }

  async resolveCommissionPercentForStore(storeId: string): Promise<{ percent: Decimal; categorySlug: string | null }> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        commissionPercentOverride: true,
        categories: { include: { category: { select: { name: true } } } },
      },
    });
    if (!store) {
      return { percent: new Decimal(this.defaultCommissionPercent()), categorySlug: null };
    }
    if (store.commissionPercentOverride != null) {
      return { percent: new Decimal(store.commissionPercentOverride.toString()), categorySlug: null };
    }
    const slugs = store.categories
      .map((c) => c.category.name.trim().toLowerCase())
      .filter(Boolean)
      .sort();
    const primarySlug = slugs[0] ?? null;
    if (!primarySlug) {
      return { percent: new Decimal(this.defaultCommissionPercent()), categorySlug: null };
    }
    const rule = await this.prisma.platformCategoryCommission.findUnique({
      where: { categorySlug: primarySlug },
    });
    const pct = rule ? new Decimal(rule.commissionPercent.toString()) : new Decimal(this.defaultCommissionPercent());
    return { percent: pct, categorySlug: primarySlug };
  }

  /**
   * Customer-facing line items + platform commission (on subtotal only).
   */
  async buildQuote(params: {
    storeId: string;
    addressLat: number;
    addressLng: number;
    storeLat: number | null;
    storeLng: number | null;
    subtotal: number;
    paymentMethod: OrderQuotePayment;
    /** When set, `deliveryFee` is forced to 0 and `deliveryDiscount` = gross list fee (first N orders, etc.). */
    waiveDeliveryFee?: boolean;
  }): Promise<OrderPricingQuote> {
    const subtotal = new Decimal(params.subtotal);
    let distanceKm = new Decimal('1');
    if (
      params.storeLat != null &&
      params.storeLng != null &&
      !Number.isNaN(params.addressLat) &&
      !Number.isNaN(params.addressLng)
    ) {
      const km = await this.resolveDistanceKm(
        Number(params.storeLat),
        Number(params.storeLng),
        params.addressLat,
        params.addressLng,
      );
      distanceKm = new Decimal(km.toFixed(4));
    }
    const fees = await this.resolveCheckoutFees();
    const deliveryFeeGross = distanceKm.mul(fees.deliveryPerKm).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const waive = Boolean(params.waiveDeliveryFee);
    const deliveryFee = waive
      ? new Decimal(0)
      : deliveryFeeGross;
    const deliveryDiscount = waive ? deliveryFeeGross : new Decimal(0);
    const serviceFee = this.computeServiceFee(fees, subtotal, deliveryFee);
    const baseBeforeSurcharge = subtotal.add(deliveryFee).add(serviceFee);

    let gstAmount = new Decimal(0);
    let cardProcessingAmount = new Decimal(0);
    if (params.paymentMethod === 'COD') {
      if (fees.codTaxEnabled && fees.codTaxRate > 0) {
        gstAmount = baseBeforeSurcharge.mul(fees.codTaxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
    } else {
      cardProcessingAmount = baseBeforeSurcharge
        .mul(fees.cardProcessingRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
    const totalAmount = baseBeforeSurcharge.add(gstAmount).add(cardProcessingAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const { percent: commissionPercent, categorySlug: categorySlugUsed } =
      await this.resolveCommissionPercentForStore(params.storeId);
    const commissionAmount = subtotal.mul(commissionPercent).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const storeAmount = subtotal.minus(commissionAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      subtotal,
      deliveryDistanceKm: distanceKm,
      deliveryFee,
      deliveryFeeGross,
      deliveryDiscount,
      serviceFee,
      baseBeforeSurcharge,
      gstAmount,
      cardProcessingAmount,
      totalAmount,
      commissionPercent,
      commissionAmount,
      storeAmount,
      categorySlugUsed,
      codTaxPercent: fees.codTaxRate * 100,
      serviceFeeMode: fees.serviceFeeMode,
      serviceFeePercent: fees.serviceFeePercent,
    };
  }

  /** Recompute customer totals when subtotal changes but fees/commission % unchanged. */
  async recomputeFromSubtotal(
    subtotal: Decimal,
    deliveryFee: Decimal,
    serviceFee: Decimal,
    paymentMethod: PaymentMethod,
    commissionPercentSnapshot: Decimal | null,
  ): Promise<{
    gstAmount: Decimal;
    cardProcessingAmount: Decimal;
    totalAmount: Decimal;
    commissionAmount: Decimal;
    storeAmount: Decimal;
  }> {
    const fees = await this.resolveCheckoutFees();
    const baseBeforeSurcharge = subtotal.add(deliveryFee).add(serviceFee);
    let gstAmount = new Decimal(0);
    let cardProcessingAmount = new Decimal(0);
    if (paymentMethod === 'CARD' || paymentMethod === 'MANUAL_TRANSFER') {
      cardProcessingAmount = baseBeforeSurcharge
        .mul(fees.cardProcessingRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      gstAmount = baseBeforeSurcharge.mul(fees.codTaxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
    const totalAmount = baseBeforeSurcharge.add(gstAmount).add(cardProcessingAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const pct = commissionPercentSnapshot ?? new Decimal(this.defaultCommissionPercent());
    const commissionAmount = subtotal.mul(pct).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const storeAmount = subtotal.minus(commissionAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return { gstAmount, cardProcessingAmount, totalAmount, commissionAmount, storeAmount };
  }
}
