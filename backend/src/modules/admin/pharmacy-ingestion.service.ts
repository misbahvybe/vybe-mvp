import { BadRequestException, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { inferMedicineFormHint, normalizeProductName } from '../../common/product/product-name.util';
import { StoresService } from '../stores/stores.service';
import { PHARMACY_REFERENCE_SEED } from './pharmacy-reference.seed';

/**
 * Ingestion strategy (no live scraping):
 * - Curated reference seed bundled with the API (see pharmacy-reference.seed.ts).
 * - Pharmacies can also paste data into CSV and use bulk upload when implemented.
 *
 * Scraping third-party pharmacy sites often violates ToS and copyright; prefer
 * licensed datasets, CSVs, or POS exports when available.
 */
@Injectable()
export class PharmacyIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoresService,
  ) {}

  async previewReferenceSeed(storeId: string) {
    await this.requireStore(storeId);
    const existing = await this.prisma.product.findMany({
      where: { storeId },
      select: { nameNormalized: true },
    });
    const existingKeys = new Set(existing.map((p) => p.nameNormalized));
    let wouldSkip = 0;
    let wouldCreate = 0;
    const preview = PHARMACY_REFERENCE_SEED.slice(0, 15).map((r) => ({
      name: r.name,
      categoryName: r.categoryName,
      description: r.description ?? null,
    }));
    for (const row of PHARMACY_REFERENCE_SEED) {
      const key = normalizeProductName(row.name);
      if (existingKeys.has(key)) wouldSkip++;
      else wouldCreate++;
    }
    return {
      totalRows: PHARMACY_REFERENCE_SEED.length,
      wouldCreate,
      wouldSkip,
      preview,
      note: 'Creates draft products (price placeholder; not visible to customers until approved).',
    };
  }

  async ingestReferenceSeed(storeId: string, dryRun: boolean) {
    await this.requireStore(storeId);
    const preview = await this.previewReferenceSeed(storeId);
    if (dryRun) {
      return { dryRun: true, ...preview };
    }

    const categories = await this.prisma.productCategory.findMany({
      where: { storeId },
      select: { id: true, name: true, sortOrder: true },
    });
    const categoryByLower = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
    let maxSort =
      (
        await this.prisma.productCategory.aggregate({
          where: { storeId },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? 0;

    const existingProducts = await this.prisma.product.findMany({
      where: { storeId },
      select: { nameNormalized: true },
    });
    const existingKeys = new Set(existingProducts.map((p) => p.nameNormalized));

    let created = 0;
    let skipped = 0;
    let categoriesCreated = 0;

    for (const row of PHARMACY_REFERENCE_SEED) {
      const key = normalizeProductName(row.name);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      let catName = row.categoryName.trim();
      let catLower = catName.toLowerCase();
      let cat = categoryByLower.get(catLower);
      if (!cat) {
        maxSort += 1;
        const catRow = await this.prisma.productCategory.create({
          data: { storeId, name: catName, sortOrder: maxSort },
        });
        categoriesCreated++;
        cat = { id: catRow.id, name: catRow.name, sortOrder: catRow.sortOrder };
        categoryByLower.set(catLower, cat);
      }

      const formHint = inferMedicineFormHint(row.name);
      const placeholderPrice = new Decimal('0.01');

      await this.prisma.product.create({
        data: {
          storeId,
          name: row.name.trim(),
          nameNormalized: key,
          description: row.description?.trim() || null,
          productCategoryId: cat!.id,
          price: placeholderPrice,
          stock: new Decimal(0),
          isOutOfStock: true,
          isAvailable: false,
          isDraft: true,
          isVerified: false,
          source: 'reference_seed',
          formHint,
        },
      });

      existingKeys.add(key);
      created++;
    }

    await this.stores.invalidatePublicStoreListCache().catch(() => undefined);

    return {
      dryRun: false,
      created,
      skipped,
      categoriesCreated,
      totalRows: PHARMACY_REFERENCE_SEED.length,
    };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new BadRequestException('Store not found');
  }
}
