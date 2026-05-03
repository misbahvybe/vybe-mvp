import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeProductName } from '../../common/product/product-name.util';
import { StoreStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { customerUnitPriceFromBase, normalizeCustomerMarkupPercent } from '../../common/pricing/customer-price-markup.util';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async global(
    q?: string,
    opts?: { takeStores?: number; takeItems?: number },
  ): Promise<{
    stores: { id: string; name: string; description: string | null; imageUrl: string | null; address: string | null }[];
    items: { id: string; name: string; price: any; storeId: string; storeName: string }[];
  }> {
    const raw = (q ?? '').trim();
    const term = raw ? normalizeProductName(raw) : '';
    const takeStores = Math.max(1, Math.min(30, opts?.takeStores ?? 12));
    const takeItems = Math.max(1, Math.min(50, opts?.takeItems ?? 20));
    if (!term) return { stores: [], items: [] };

    // Prefer pg_trgm similarity ranking (fast + typo-tolerant). Fall back to Prisma contains if extension isn't available.
    let stores: { id: string; name: string; description: string | null; imageUrl: string | null; address: string | null }[] = [];
    let items: { id: string; name: string; price: any; storeId: string; storeName: string }[] = [];
    try {
      stores = await this.prisma.$queryRaw<
        { id: string; name: string; description: string | null; imageUrl: string | null; address: string | null }[]
      >(Prisma.sql`
        SELECT s.id, s.name, s.description, s.image_url AS "imageUrl", s.address
        FROM "Store" s
        WHERE s.is_approved = true
          AND s.store_status <> 'INACTIVE'
          AND (
            (s.name % ${raw}) OR (COALESCE(s.description, '') % ${raw})
            OR (s.name ILIKE ${`%${raw}%`}) OR (COALESCE(s.description, '') ILIKE ${`%${raw}%`})
          )
        ORDER BY GREATEST(similarity(s.name, ${raw}), similarity(COALESCE(s.description, ''), ${raw})) DESC,
                 s.created_at DESC
        LIMIT ${takeStores}
      `);

      const itemRows = await this.prisma.$queryRaw<
        {
          id: string;
          name: string;
          price: any;
          storeId: string;
          storeName: string;
          customerPriceMarkupPercent: any;
        }[]
      >(Prisma.sql`
        SELECT p.id, p.name, p.price, p.store_id AS "storeId", s.name AS "storeName",
          s.customer_price_markup_percent AS "customerPriceMarkupPercent"
        FROM "Product" p
        JOIN "Store" s ON s.id = p.store_id
        WHERE p.is_draft = false
          AND p.is_available = true
          AND p.is_out_of_stock = false
          AND s.is_approved = true
          AND s.store_status <> 'INACTIVE'
          AND (
            (p.name_normalized % ${term}) OR (p.name_normalized ILIKE ${`%${term}%`})
          )
        ORDER BY similarity(p.name_normalized, ${term}) DESC, p.name ASC
        LIMIT ${takeItems}
      `);

      items = itemRows.map(({ customerPriceMarkupPercent, ...row }) => ({
        ...row,
        price: customerUnitPriceFromBase(row.price, normalizeCustomerMarkupPercent(customerPriceMarkupPercent)),
      }));
    } catch {
      // 1) Store-level match fallback
      stores = await this.prisma.store.findMany({
        where: {
          isApproved: true,
          status: { not: StoreStatus.INACTIVE },
          OR: [
            { name: { contains: raw, mode: 'insensitive' } },
            { description: { contains: raw, mode: 'insensitive' } },
          ],
        },
        take: takeStores,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, description: true, imageUrl: true, address: true },
      });

      // 2) Item-level match fallback
      const fallbackItems = await this.prisma.product.findMany({
        where: {
          isDraft: false,
          isAvailable: true,
          isOutOfStock: false,
          nameNormalized: { contains: term },
          store: { isApproved: true, status: { not: StoreStatus.INACTIVE } },
        },
        take: takeItems,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          price: true,
          storeId: true,
          store: { select: { name: true, customerPriceMarkupPercent: true } },
        },
      });
      items = fallbackItems.map((i) => ({
        id: i.id,
        name: i.name,
        price: customerUnitPriceFromBase(i.price, normalizeCustomerMarkupPercent(i.store.customerPriceMarkupPercent)),
        storeId: i.storeId,
        storeName: i.store.name,
      }));
    }

    return {
      stores,
      items,
    };
  }
}

