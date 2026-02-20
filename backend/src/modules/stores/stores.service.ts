import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreForOwner(ownerId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId },
      include: {
        productCategories: { orderBy: { sortOrder: 'asc' }, include: { products: true } },
        products: { include: { category: true } },
      },
    });
    if (!store) return null;
    return { ...store, isOpenNow: this.isStoreOpen(store) };
  }

  async updateStore(ownerId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    return this.prisma.store.update({
      where: { id: store.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.openingTime !== undefined && { openingTime: dto.openingTime }),
        ...(dto.closingTime !== undefined && { closingTime: dto.closingTime }),
        ...(dto.isOpen !== undefined && { isOpen: dto.isOpen }),
      },
    });
  }

  async getEarnings(ownerId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
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
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    return this.prisma.productCategory.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'asc' },
      include: { products: true },
    });
  }

  async createCategory(ownerId: string, dto: CreateProductCategoryDto) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    return this.prisma.productCategory.create({
      data: { storeId: store.id, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async updateCategory(ownerId: string, categoryId: string, dto: UpdateProductCategoryDto) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    const cat = await this.prisma.productCategory.findFirst({ where: { id: categoryId, storeId: store.id } });
    if (!cat) throw new ForbiddenException('Category not found');
    return this.prisma.productCategory.update({
      where: { id: categoryId },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }) },
    });
  }

  async deleteCategory(ownerId: string, categoryId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    const cat = await this.prisma.productCategory.findFirst({ where: { id: categoryId, storeId: store.id } });
    if (!cat) throw new ForbiddenException('Category not found');
    await this.prisma.product.updateMany({ where: { productCategoryId: categoryId }, data: { productCategoryId: null } });
    return this.prisma.productCategory.delete({ where: { id: categoryId } });
  }

  async getProducts(ownerId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    return this.prisma.product.findMany({
      where: { storeId: store.id },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  async createProduct(ownerId: string, dto: CreateProductDto) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    if (dto.productCategoryId) {
      const cat = await this.prisma.productCategory.findFirst({ where: { id: dto.productCategoryId, storeId: store.id } });
      if (!cat) throw new ForbiddenException('Category not found');
    }
    return this.prisma.product.create({
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
  }

  async updateProduct(ownerId: string, productId: string, dto: UpdateProductDto) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
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
    return this.prisma.product.update({ where: { id: productId }, data });
  }

  async deleteProduct(ownerId: string, productId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    return this.prisma.product.delete({ where: { id: productId } });
  }

  async setProductOutOfStock(ownerId: string, productId: string, isOutOfStock: boolean) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new ForbiddenException('Store not found');
    const prod = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!prod) throw new ForbiddenException('Product not found');
    return this.prisma.product.update({
      where: { id: productId },
      data: { isOutOfStock, isAvailable: !isOutOfStock },
    });
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
    const where: { isApproved: boolean; categories?: { some: { category: { name: string } } } } = {
      isApproved: true,
    };
    if (category?.trim()) {
      const cat = category.trim().toLowerCase();
      where.categories = {
        some: { category: { name: cat } },
      };
    }
    const stores = await this.prisma.store.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        products: { where: { isAvailable: true, isOutOfStock: false }, take: 4 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return stores
      .map((s) => ({ ...s, isOpenNow: this.isStoreOpen(s) }))
      .filter((s) => s.isOpenNow);
  }

  async getById(id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, isApproved: true },
      include: {
        owner: { select: { name: true } },
        products: { where: { isAvailable: true } },
      },
    });
    if (!store) return null;
    return {
      ...store,
      isOpenNow: this.isStoreOpen(store),
    };
  }
}
