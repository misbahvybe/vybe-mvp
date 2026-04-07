import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { haversineDistanceKm } from '../../common/geo/haversine';
import { CheckoutServiceFeeMode, PaymentMethod } from '@prisma/client';

export type OrderQuotePayment = 'COD' | 'CARD';

export interface OrderPricingQuote {
  subtotal: Decimal;
  deliveryDistanceKm: Decimal;
  deliveryFee: Decimal;
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
  cardProcessingRate: number;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private deliveryPerKm(): number {
    return Number(this.config.get<string>('DELIVERY_FEE_PER_KM') ?? '45');
  }

  /**
   * DB-backed checkout fees (admin). Falls back to env when row missing (e.g. before migrate).
   * COD_GST_RATE env: decimal fraction (0.16) or percent (16) — normalized to 0–1.
   */
  private async resolveCheckoutFees(): Promise<ResolvedCheckoutFees> {
    const row = await this.prisma.platformCheckoutSettings.findUnique({ where: { id: 'default' } });
    const envFee = Number(this.config.get<string>('MIN_SERVICE_FEE_PKR') ?? '19.99');
    const envCodRaw = Number(this.config.get<string>('COD_GST_RATE') ?? '0.16');
    const envCodRate = envCodRaw > 1 ? envCodRaw / 100 : envCodRaw;
    const cardProcessingRate = Number(this.config.get<string>('CARD_PROCESSING_RATE') ?? '0.05');
    if (!row) {
      return {
        serviceFeeMode: CheckoutServiceFeeMode.FIXED,
        serviceFeeFixed: envFee,
        serviceFeePercent: 0,
        codTaxRate: envCodRate,
        cardProcessingRate,
      };
    }
    const codPct = Number(row.codTaxPercent.toString());
    return {
      serviceFeeMode: row.serviceFeeMode,
      serviceFeeFixed: Number(row.serviceFeeFixed.toString()),
      serviceFeePercent: Number(row.serviceFeePercent.toString()),
      codTaxRate: codPct / 100,
      cardProcessingRate,
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
    const deliveryFee = distanceKm.mul(this.deliveryPerKm()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const fees = await this.resolveCheckoutFees();
    const serviceFee = this.computeServiceFee(fees, subtotal, deliveryFee);
    const baseBeforeSurcharge = subtotal.add(deliveryFee).add(serviceFee);

    let gstAmount = new Decimal(0);
    let cardProcessingAmount = new Decimal(0);
    if (params.paymentMethod === 'COD') {
      gstAmount = baseBeforeSurcharge.mul(fees.codTaxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
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
    if (paymentMethod === 'CARD') {
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
