import { Decimal } from '@prisma/client/runtime/library';

const DEFAULT_PCT = 10;

export function defaultCustomerMarkupPercent(): number {
  return DEFAULT_PCT;
}

/** Clamp stored / API markup to a safe range (percent points on top of catalogue). */
export function normalizeCustomerMarkupPercent(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PCT;
  return Math.min(500, Math.round(n * 100) / 100);
}

export function markupPercentToMultiplier(percent: number | string | Decimal): Decimal {
  const p = percent instanceof Decimal ? percent : new Decimal(percent);
  return new Decimal(1).add(p.div(100));
}

/** Catalogue unit price → customer unit price for a given markup % (half-up, 2 dp). */
export function customerUnitPriceFromBase(
  base: Decimal | number | string,
  markupPercent: number = DEFAULT_PCT,
): Decimal {
  const b = base instanceof Decimal ? base : new Decimal(base);
  const mult = markupPercentToMultiplier(markupPercent);
  return b.mul(mult).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

type Productish = { price: Decimal } & Record<string, unknown>;
type Variantish = { price: Decimal } & Record<string, unknown>;

export function productWithCustomerPrices<P extends Productish & { variants?: Variantish[] }>(
  p: P,
  markupPercent: number,
): P {
  const price = customerUnitPriceFromBase(p.price, markupPercent);
  const variants = p.variants?.map((v) => ({
    ...v,
    price: customerUnitPriceFromBase(v.price, markupPercent),
  }));
  return { ...p, price, variants } as P;
}

export function productsWithCustomerPrices<T extends Productish & { variants?: Variantish[] }>(
  list: T[],
  markupPercent: number,
): T[] {
  return list.map((p) => productWithCustomerPrices(p, markupPercent));
}
