import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpstashService } from '../../common/upstash/upstash.service';
import { Role, StoreStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly upstash: UpstashService,
  ) {}

  private storeListCacheKey(category?: string): string {
    const c = category?.trim().toLowerCase() || 'all';
    return `stores:list:v1:${c}`;
  }

  private storeListCacheTtlSeconds(): number {
    const n = Number(this.config.get<string>('STORE_LIST_CACHE_TTL_SECONDS') ?? 60);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : 60;
  }

  /** Call after any change that affects customer-facing store listings. */
  async invalidatePublicStoreListCache(): Promise<void> {
    if (!this.upstash.enabled) return;
    const keys = new Set<string>([
      this.storeListCacheKey(),
      this.storeListCacheKey('food'),
      this.storeListCacheKey('grocery'),
      this.storeListCacheKey('medicine'),
    ]);
    const cats = await this.prisma.storeCategory.findMany({ select: { name: true } });
    for (const c of cats) keys.add(this.storeListCacheKey(c.name));
    await this.upstash.delMany([...keys]);
  }

  /** Legacy owners may have no Store row; create one on first use (same defaults as admin bootstrap). */
  private async bootstrapStoreIfMissing(ownerId: string): Promise<void> {
    const exists = await this.prisma.store.findFirst({ where: { ownerId }, select: { id: true } });
    if (exists) return;
    const user = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!user || user.role !== Role.STORE_OWNER) return;
    await this.prisma.store.create({
      data: {
        ownerId,
        name: `${user.name.trim()}'s store`,
        city: 'Lahore',
        phone: user.phone,
        isApproved: true,
        isOpen: true,
      },
    });
  }

  private async getOwnedStoreOrThrow(ownerId: string) {
    await this.bootstrapStoreIfMissing(ownerId);
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    return store;
  }

  async getStoreForOwner(ownerId: string) {
    await this.bootstrapStoreIfMissing(ownerId);
    const store = await this.prisma.store.findFirst({
      where: { ownerId },
      include: {
        productCategories: { orderBy: { sortOrder: 'asc' }, include: { products: true } },
        products: { include: { category: true, variants: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!store) return null;
    return { ...store, isOpenNow: this.isStoreOpen(store) };
  }

  async updateStore(ownerId: string, dto: UpdateStoreDto) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.openingTime !== undefined) data.openingTime = dto.openingTime;
    if (dto.closingTime !== undefined) data.closingTime = dto.closingTime;
    if (dto.isOpen !== undefined) data.isOpen = dto.isOpen;
    const updated = await this.prisma.store.update({ where: { id: store.id }, data });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return updated;
  }

  async getEarnings(ownerId: string) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [todayAgg, todayOrders, allEarnings] = await Promise.all([
      this.prisma.storeEarning.aggregate({
        where: {
          storeId: store.id,
          order: { orderStatus: 'DELIVERED', updatedAt: { gte: today, lt: tomorrow } },
        },
        _sum: { storeAmount: true, commissionAmount: true },
        _count: true,
      }),
      this.prisma.order.count({
        where: { storeId: store.id, orderStatus: 'DELIVERED', updatedAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.storeEarning.findMany({
        where: { storeId: store.id, order: { orderStatus: 'DELIVERED' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { order: { select: { id: true, createdAt: true } } },
      }),
    ]);
    const revenue = Number(todayAgg._sum.storeAmount ?? 0) + Number(todayAgg._sum.commissionAmount ?? 0);
    const commission = Number(todayAgg._sum.commissionAmount ?? 0);
    const net = Number(todayAgg._sum.storeAmount ?? 0);
    return {
      today: { orders: todayOrders, revenue, commission, net },
      history: allEarnings.map((e) => ({
        orderId: e.orderId,
        createdAt: e.order.createdAt,
        storeAmount: Number(e.storeAmount),
        commissionAmount: Number(e.commissionAmount),
      })),
    };
  }

  async getCategories(ownerId: string) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    return this.prisma.productCategory.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'asc' },
      include: { products: true },
    });
  }

  async createCategory(ownerId: string, dto: CreateProductCategoryDto) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const row = await this.prisma.productCategory.create({
      data: { storeId: store.id, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async updateCategory(ownerId: string, categoryId: string, dto: UpdateProductCategoryDto) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const cat = await this.prisma.productCategory.findFirst({ where: { id: categoryId, storeId: store.id } });
    if (!cat) throw new ForbiddenException('Category not found');
    const row = await this.prisma.productCategory.update({
      where: { id: categoryId },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }) },
    });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async deleteCategory(ownerId: string, categoryId: string) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const cat = await this.prisma.productCategory.findFirst({ where: { id: categoryId, storeId: store.id } });
    if (!cat) throw new ForbiddenException('Category not found');
    await this.prisma.product.updateMany({ where: { productCategoryId: categoryId }, data: { productCategoryId: null } });
    const row = await this.prisma.productCategory.delete({ where: { id: categoryId } });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async getProducts(ownerId: string) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    return this.prisma.product.findMany({
      where: { storeId: store.id },
      include: { category: true, variants: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  async createProduct(ownerId: string, dto: CreateProductDto) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    if (dto.productCategoryId) {
      const cat = await this.prisma.productCategory.findFirst({ where: { id: dto.productCategoryId, storeId: store.id } });
      if (!cat) throw new ForbiddenException('Category not found');
    }
    const row = await this.prisma.product.create({
      data: {
        storeId: store.id,
        name: dto.name,
        description: dto.description,
        price: new Decimal(dto.price),
        stock: dto.stock ?? 999,
        isAvailable: dto.isAvailable ?? true,
        imageUrl: dto.imageUrl,
        productCategoryId: dto.productCategoryId || null,
      },
    });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async updateProduct(ownerId: string, productId: string, dto: UpdateProductDto) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    if (dto.productCategoryId !== undefined && dto.productCategoryId) {
      const cat = await this.prisma.productCategory.findFirst({ where: { id: dto.productCategoryId, storeId: store.id } });
      if (!cat) throw new ForbiddenException('Category not found');
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = new Decimal(dto.price);
    if (dto.stock !== undefined) {
      data.stock = new Decimal(dto.stock);
      data.isOutOfStock = dto.stock <= 0;
    }
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.productCategoryId !== undefined) data.productCategoryId = dto.productCategoryId || null;
    if (dto.isAvailable === false) data.isOutOfStock = true;
    const row = await this.prisma.product.update({ where: { id: productId }, data });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async deleteProduct(ownerId: string, productId: string) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    const row = await this.prisma.product.delete({ where: { id: productId } });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async setProductOutOfStock(ownerId: string, productId: string, isOutOfStock: boolean) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    const row = await this.prisma.product.update({
      where: { id: productId },
      data: { isOutOfStock, isAvailable: !isOutOfStock },
    });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async listProductVariants(ownerId: string, productId: string) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    return this.prisma.productVariant.findMany({ where: { productId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async createProductVariant(ownerId: string, productId: string, dto: CreateProductVariantDto) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    const row = await this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name.trim(),
        price: new Decimal(dto.price),
        isAvailable: dto.isAvailable ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async updateProductVariant(ownerId: string, productId: string, variantId: string, dto: UpdateProductVariantDto) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new ForbiddenException('Variant not found');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.price !== undefined) data.price = new Decimal(dto.price);
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const row = await this.prisma.productVariant.update({ where: { id: variantId }, data });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  async deleteProductVariant(ownerId: string, productId: string, variantId: string) {
    const store = await this.getOwnedStoreOrThrow(ownerId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new ForbiddenException('Variant not found');
    const row = await this.prisma.productVariant.delete({ where: { id: variantId } });
    await this.invalidatePublicStoreListCache().catch(() => undefined);
    return row;
  }

  private isStoreOpen(store: { isOpen: boolean; openingTime: string | null; closingTime: string | null }): boolean {
    if (!store.isOpen) return false;
    if (!store.openingTime || !store.closingTime) return true;
    const now = new Date();
    const [oh, om] = store.openingTime.split(':').map(Number);
    const [ch, cm] = store.closingTime.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const openMins = oh * 60 + om;
    let closeMins = ch * 60 + cm;
    if (closeMins <= openMins) closeMins += 24 * 60;
    return nowMins >= openMins && nowMins < closeMins;
  }

  async listApproved(category?: string) {
    const ttl = this.storeListCacheTtlSeconds();
    const key = this.storeListCacheKey(category);
    return this.upstash.wrapJson(key, ttl, () => this.listApprovedUncached(category));
  }

  private async listApprovedUncached(category?: string) {
    const where: { isApproved: boolean; categories?: { some: { category: { name: string } } } } = {
      isApproved: true,
    };
    if (category?.trim()) {
      const cat = category.trim().toLowerCase();
      where.categories = {
        // Be resilient to existing DB values like "Food" vs "food"
        some: { category: { name: { equals: cat, mode: 'insensitive' } } as any },
      };
    }
    const stores = await this.prisma.store.findMany({
      where: { ...where, status: { not: StoreStatus.INACTIVE } },
      include: {
        owner: { select: { name: true } },
        products: {
          where: { isAvailable: true, isOutOfStock: false },
          take: 4,
          include: { variants: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return stores.map((s) => {
      const isOpenNow = this.isStoreOpen(s);
      const products = s.status === StoreStatus.ACTIVE ? s.products : [];
      return {
        ...s,
        products,
        isOpenNow,
        menuAvailable: s.status === StoreStatus.ACTIVE && products.length > 0,
        menuMessage:
          s.status === StoreStatus.INVITED
            ? 'Menu not available yet'
            : s.status === StoreStatus.INACTIVE
              ? 'Store is currently unavailable'
              : products.length === 0
                ? 'Menu not available yet'
                : null,
      };
    });
  }

  async getById(id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, isApproved: true, status: { not: StoreStatus.INACTIVE } },
      include: {
        owner: { select: { name: true } },
        productCategories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              where: { isAvailable: true, isOutOfStock: false },
              orderBy: { name: 'asc' },
              include: { variants: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        products: {
          where: { isAvailable: true, isOutOfStock: false },
          orderBy: { name: 'asc' },
          include: { variants: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!store) return null;
    const products = store.status === StoreStatus.ACTIVE ? store.products : [];
    return {
      ...store,
      products,
      isOpenNow: this.isStoreOpen(store),
      menuAvailable: store.status === StoreStatus.ACTIVE && products.length > 0,
      menuMessage:
        store.status === StoreStatus.INVITED
          ? 'Menu not available yet'
          : store.status === StoreStatus.INACTIVE
            ? 'Store is currently unavailable'
            : products.length === 0
              ? 'Menu not available yet'
              : null,
    };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new BadRequestException('Store not found');
    return store;
  }

  async adminGetCategories(storeId: string) {
    await this.requireStore(storeId);
    return this.prisma.productCategory.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
      include: { products: true },
    });
  }

  async adminCreateCategory(storeId: string, dto: CreateProductCategoryDto) {
    await this.requireStore(storeId);
    return this.prisma.productCategory.create({
      data: { storeId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async adminUpdateCategory(storeId: string, categoryId: string, dto: UpdateProductCategoryDto) {
    await this.requireStore(storeId);
    const cat = await this.prisma.productCategory.findFirst({ where: { id: categoryId, storeId } });
    if (!cat) throw new BadRequestException('Category not found');
    return this.prisma.productCategory.update({
      where: { id: categoryId },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }) },
    });
  }

  async adminDeleteCategory(storeId: string, categoryId: string) {
    await this.requireStore(storeId);
    const cat = await this.prisma.productCategory.findFirst({ where: { id: categoryId, storeId } });
    if (!cat) throw new BadRequestException('Category not found');
    await this.prisma.product.updateMany({ where: { productCategoryId: categoryId }, data: { productCategoryId: null } });
    return this.prisma.productCategory.delete({ where: { id: categoryId } });
  }

  async adminGetProducts(storeId: string) {
    await this.requireStore(storeId);
    return this.prisma.product.findMany({
      where: { storeId },
      include: { category: true, variants: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  async adminCreateProduct(storeId: string, dto: CreateProductDto) {
    await this.requireStore(storeId);
    if (dto.productCategoryId) {
      const cat = await this.prisma.productCategory.findFirst({ where: { id: dto.productCategoryId, storeId } });
      if (!cat) throw new BadRequestException('Category not found');
    }
    return this.prisma.product.create({
      data: {
        storeId,
        name: dto.name,
        description: dto.description,
        price: new Decimal(dto.price),
        stock: dto.stock ?? 999,
        isAvailable: dto.isAvailable ?? true,
        imageUrl: dto.imageUrl,
        productCategoryId: dto.productCategoryId || null,
      },
    });
  }

  async adminUpdateProduct(storeId: string, productId: string, dto: UpdateProductDto) {
    await this.requireStore(storeId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!prod) throw new BadRequestException('Product not found');
    if (dto.productCategoryId !== undefined && dto.productCategoryId) {
      const cat = await this.prisma.productCategory.findFirst({ where: { id: dto.productCategoryId, storeId } });
      if (!cat) throw new BadRequestException('Category not found');
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = new Decimal(dto.price);
    if (dto.stock !== undefined) {
      data.stock = new Decimal(dto.stock);
      data.isOutOfStock = dto.stock <= 0;
    }
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.productCategoryId !== undefined) data.productCategoryId = dto.productCategoryId || null;
    if (dto.isAvailable === false) data.isOutOfStock = true;
    return this.prisma.product.update({ where: { id: productId }, data });
  }

  async adminDeleteProduct(storeId: string, productId: string) {
    await this.requireStore(storeId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!prod) throw new BadRequestException('Product not found');
    try {
      return await this.prisma.product.delete({ where: { id: productId } });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException(
          'This product appears on existing orders and cannot be deleted. Mark it unavailable or out of stock instead.',
        );
      }
      throw e;
    }
  }

  async adminSetProductOutOfStock(storeId: string, productId: string, isOutOfStock: boolean) {
    await this.requireStore(storeId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!prod) throw new BadRequestException('Product not found');
    return this.prisma.product.update({
      where: { id: productId },
      data: { isOutOfStock, isAvailable: !isOutOfStock },
    });
  }

  async adminListProductVariants(storeId: string, productId: string) {
    await this.requireStore(storeId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!prod) throw new BadRequestException('Product not found');
    return this.prisma.productVariant.findMany({ where: { productId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async adminCreateProductVariant(storeId: string, productId: string, dto: CreateProductVariantDto) {
    await this.requireStore(storeId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!prod) throw new BadRequestException('Product not found');
    return this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name.trim(),
        price: new Decimal(dto.price),
        isAvailable: dto.isAvailable ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async adminUpdateProductVariant(storeId: string, productId: string, variantId: string, dto: UpdateProductVariantDto) {
    await this.requireStore(storeId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!prod) throw new BadRequestException('Product not found');
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new BadRequestException('Variant not found');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.price !== undefined) data.price = new Decimal(dto.price);
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.productVariant.update({ where: { id: variantId }, data });
  }

  async adminDeleteProductVariant(storeId: string, productId: string, variantId: string) {
    await this.requireStore(storeId);
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!prod) throw new BadRequestException('Product not found');
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new BadRequestException('Variant not found');
    return this.prisma.productVariant.delete({ where: { id: variantId } });
  }
}
