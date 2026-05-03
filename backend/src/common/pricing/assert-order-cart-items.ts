import { BadRequestException } from '@nestjs/common';
import { Product, ProductVariant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertMinOrderSubtotalPkr } from '../constants/order-minimum';
import { customerUnitPriceFromBase, normalizeCustomerMarkupPercent } from './customer-price-markup.util';

/**
 * Validate checkout line items against the catalogue, enforce optional stock, anti-tamper customer prices.
 * Returns customer subtotal (with store markup) and store catalogue subtotal (before markup).
 */
export async function assertOrderCartItemsAndTotals(
  db: Pick<PrismaService, 'product' | 'productVariant' | 'store'>,
  storeId: string,
  items: { productId: string; variantId?: string; quantity: number; price?: number }[],
  options: { checkStock: boolean },
): Promise<{
  subtotal: number;
  subtotalBase: number;
  customerMarkupPercent: number;
  productById: Map<string, Product>;
  variantById: Map<string, ProductVariant>;
}> {
  const storeRow = await db.store.findUnique({
    where: { id: storeId },
    select: { customerPriceMarkupPercent: true },
  });
  const markupPercent = normalizeCustomerMarkupPercent(storeRow?.customerPriceMarkupPercent);

  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, storeId },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))] as string[];
  const variants = variantIds.length
    ? await db.productVariant.findMany({ where: { id: { in: variantIds } } })
    : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));
  let subtotal = 0;
  let subtotalBase = 0;
  for (const item of items) {
    const prod = productById.get(item.productId);
    if (!prod) throw new BadRequestException(`Product ${item.productId} not found`);
    if (prod.isDraft) {
      throw new BadRequestException(`Product "${prod.name}" is not available for sale yet`);
    }
    if (options.checkStock) {
      const stock = Number(prod.stock);
      if (prod.isOutOfStock || stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${prod.name}. Available: ${stock} ${stock === 0 ? '(out of stock)' : ''}`,
        );
      }
    }
    const variant = item.variantId ? variantById.get(item.variantId) : null;
    if (item.variantId && (!variant || variant.productId !== prod.id)) {
      throw new BadRequestException(`Variant ${item.variantId} not found for ${prod.name}`);
    }
    if (variant && variant.isAvailable === false) {
      throw new BadRequestException(`Variant ${variant.name} is unavailable for ${prod.name}`);
    }
    const baseUnit = variant ? variant.price : prod.price;
    const customerUnit = customerUnitPriceFromBase(baseUnit, markupPercent);
    const customerNum = customerUnit.toNumber();
    const baseNum = Number(baseUnit);
    if (item.price != null && Math.abs(Number(item.price) - customerNum) > 0.02) {
      throw new BadRequestException(`Price mismatch for ${prod.name}`);
    }
    subtotal += item.quantity * customerNum;
    subtotalBase += item.quantity * baseNum;
  }
  assertMinOrderSubtotalPkr(subtotal);
  return { subtotal, subtotalBase, customerMarkupPercent: markupPercent, productById, variantById };
}
