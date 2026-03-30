import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { StoresService } from '../stores/stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreateProductCategoryDto } from '../stores/dto/create-product-category.dto';
import { UpdateProductCategoryDto } from '../stores/dto/update-product-category.dto';
import { CreateProductDto } from '../stores/dto/create-product.dto';
import { UpdateProductDto } from '../stores/dto/update-product.dto';
import { PatchPlatformCategoryCommissionDto } from './dto/patch-platform-category-commission.dto';
import { UpdateStoreCommissionOverrideDto } from './dto/update-store-commission-override.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly stores: StoresService,
  ) {}

  @Post('partners')
  async createPartner(@CurrentUser() user: User, @Body() dto: CreatePartnerDto) {
    return this.admin.createPartner(user.id, dto);
  }

  @Get('partners')
  async listPartners(@CurrentUser() _user: User) {
    return this.admin.listPartners(_user.id);
  }

  @Get('metrics')
  async getMetrics(@CurrentUser() _user: User) {
    return this.admin.getMetrics();
  }

  @Get('alerts')
  async getAlerts(@CurrentUser() _user: User) {
    return this.admin.getAlerts();
  }

  @Get('stores')
  async getStores(@CurrentUser() _user: User) {
    return this.admin.getStores();
  }

  @Get('riders')
  async getRiders(@CurrentUser() _user: User) {
    return this.admin.getRiders();
  }

  @Get('users')
  async getUsers(@CurrentUser() _user: User) {
    return this.admin.getUsers();
  }

  @Get('finance')
  async getFinance(@CurrentUser() _user: User) {
    return this.admin.getFinance();
  }

  @Get('pricing/platform-category-commissions')
  async listPlatformCategoryCommissions(@CurrentUser() _user: User) {
    return this.admin.listPlatformCategoryCommissions();
  }

  @Patch('pricing/platform-category-commissions/:categorySlug')
  async patchPlatformCategoryCommission(
    @Param('categorySlug') categorySlug: string,
    @Body() dto: PatchPlatformCategoryCommissionDto,
  ) {
    return this.admin.upsertPlatformCategoryCommission(categorySlug, dto.commissionPercent);
  }

  @Patch('stores/:storeId/commission-override')
  async patchStoreCommissionOverride(
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreCommissionOverrideDto,
  ) {
    return this.admin.setStoreCommissionOverride(storeId, dto.commissionPercentOverride);
  }

  @Get('metrics/charts')
  async getMetricsCharts(@CurrentUser() _user: User) {
    return this.admin.getMetricsCharts();
  }

  @Get('stores/:storeId/categories')
  async adminStoreCategories(@Param('storeId') storeId: string) {
    return this.stores.adminGetCategories(storeId);
  }

  @Post('stores/:storeId/categories')
  async adminCreateCategory(@Param('storeId') storeId: string, @Body() dto: CreateProductCategoryDto) {
    return this.stores.adminCreateCategory(storeId, dto);
  }

  @Patch('stores/:storeId/categories/:categoryId')
  async adminUpdateCategory(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.stores.adminUpdateCategory(storeId, categoryId, dto);
  }

  @Delete('stores/:storeId/categories/:categoryId')
  async adminDeleteCategory(@Param('storeId') storeId: string, @Param('categoryId') categoryId: string) {
    return this.stores.adminDeleteCategory(storeId, categoryId);
  }

  @Get('stores/:storeId/products')
  async adminStoreProducts(@Param('storeId') storeId: string) {
    return this.stores.adminGetProducts(storeId);
  }

  @Post('stores/:storeId/products')
  async adminCreateProduct(@Param('storeId') storeId: string, @Body() dto: CreateProductDto) {
    return this.stores.adminCreateProduct(storeId, dto);
  }

  @Patch('stores/:storeId/products/:productId')
  async adminUpdateProduct(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.stores.adminUpdateProduct(storeId, productId, dto);
  }

  @Delete('stores/:storeId/products/:productId')
  async adminDeleteProduct(@Param('storeId') storeId: string, @Param('productId') productId: string) {
    return this.stores.adminDeleteProduct(storeId, productId);
  }

  @Patch('stores/:storeId/products/:productId/out-of-stock')
  async adminSetProductOutOfStock(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() body: { isOutOfStock: boolean },
  ) {
    return this.stores.adminSetProductOutOfStock(storeId, productId, body.isOutOfStock ?? false);
  }
}
