import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PharmacyIngestionService } from './pharmacy-ingestion.service';
import { StoresService } from '../stores/stores.service';
import { RidersService } from '../riders/riders.service';
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
import { CreateProductVariantDto } from '../stores/dto/create-product-variant.dto';
import { UpdateProductVariantDto } from '../stores/dto/update-product-variant.dto';
import { PatchPlatformCategoryCommissionDto } from './dto/patch-platform-category-commission.dto';
import { PatchPlatformCheckoutSettingsDto } from './dto/patch-platform-checkout-settings.dto';
import { UpdateStoreCommissionOverrideDto } from './dto/update-store-commission-override.dto';
import { UpdateStoreCustomerMarkupDto } from './dto/update-store-customer-markup.dto';
import { UpdateStoreStatusDto } from './dto/update-store-status.dto';
import { SetStorePlatformCategoriesDto } from './dto/set-store-platform-categories.dto';
import { IngestReferenceDto } from './dto/ingest-reference.dto';
import { ApproveDraftProductDto } from '../stores/dto/approve-draft-product.dto';
import { UpdateStoreMinimumOrderDto } from './dto/update-store-minimum-order.dto';
import { UpdateStoreDto } from '../stores/dto/update-store.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly stores: StoresService,
    private readonly pharmacyIngestion: PharmacyIngestionService,
    private readonly riders: RidersService,
  ) {}

  @Post('partners')
  async createPartner(@CurrentUser() user: User, @Body() dto: CreatePartnerDto) {
    return this.admin.createPartner(user.id, dto);
  }

  @Get('partners')
  async listPartners() {
    return this.admin.listPartners();
  }

  /** Fix store owners who have no Store row (older invites) — stops 403 on /store-owner/*. */
  @Post('partners/:userId/bootstrap-store')
  async bootstrapPartnerStore(@Param('userId') userId: string) {
    return this.admin.bootstrapStoreForPartnerUser(userId);
  }

  @Post('partners/:userId/regenerate-invite')
  async regeneratePartnerInvite(@Param('userId') userId: string) {
    return this.admin.regeneratePartnerInvite(userId);
  }

  @Get('metrics')
  async getMetrics(@CurrentUser() _user: User) {
    return this.admin.getMetrics();
  }

  @Get('alerts')
  async getAlerts(@CurrentUser() _user: User) {
    return this.admin.getAlerts();
  }

  @Get('orders/live/count')
  async getLiveOrderCount(@CurrentUser() _user: User) {
    return this.admin.getLiveOrderCount();
  }

  @Get('orders/live')
  async getLiveOrders(@CurrentUser() _user: User) {
    return this.admin.getLiveOrders();
  }

  /** @query platform Optional filter: `food`, `grocery`, or `medicine` (platform tabs). */
  @Get('stores')
  async getStores(
    @CurrentUser() _user: User,
    @Query('platform') platform?: string,
    @Query('includeUnapproved') includeUnapproved?: string,
  ) {
    return this.admin.getStores(platform, includeUnapproved === 'true');
  }

  /**
   * Platform verticals (food/grocery/medicine) for a store — alternate path so production
   * proxies / older route tables cannot shadow `stores/:id/platform-categories`.
   */
  @Get('platform-store-categories/:storeId')
  async getPlatformStoreCategoriesAlt(@Param('storeId') storeId: string) {
    return this.admin.getStorePlatformCategories(storeId);
  }

  @Post('platform-store-categories/:storeId')
  async postPlatformStoreCategoriesAlt(
    @Param('storeId') storeId: string,
    @Body() dto: SetStorePlatformCategoriesDto,
  ) {
    return this.admin.setStorePlatformCategories(storeId, dto.names);
  }

  @Get('riders')
  async getRiders(@CurrentUser() _user: User) {
    return this.admin.getRiders();
  }

  @Get('riders/:riderId')
  async getRider(@CurrentUser() _user: User, @Param('riderId') riderId: string) {
    return this.admin.getRiderById(riderId);
  }

  /** Mark rider COD as received at office — clears balance and unblocks new pickups. */
  @Post('riders/:riderId/settle-cod')
  async settleRiderCod(@CurrentUser() user: User, @Param('riderId') riderId: string) {
    return this.riders.resetCodBalanceAfterSettlement(user.id, riderId);
  }

  @Get('users')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0')
  async getUsers(
    @CurrentUser() _user: User,
    @Query('sort') sort?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.getUsers({
      sort: sort === 'oldest' ? 'oldest' : 'newest',
      q: q?.trim() || undefined,
    });
  }

  /** Reset ordering block + strike count (e.g. testing account hit VYBE_ORDER_STRIKES) */
  @Patch('users/:userId/unblock-ordering')
  async unblockCustomerOrdering(@Param('userId') userId: string) {
    return this.admin.unblockCustomerOrdering(userId);
  }

  @Get('finance')
  async getFinance(@CurrentUser() _user: User) {
    return this.admin.getFinance();
  }

  /** Approve / reject log for manual bank-transfer payment verification. */
  @Get('audit-logs/manual-payments')
  async listManualPaymentAuditLogs(
    @CurrentUser() _user: User,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.admin.listManualPaymentAuditLogs({
      limit: limit != null && limit !== '' ? parseInt(limit, 10) : undefined,
      offset: offset != null && offset !== '' ? parseInt(offset, 10) : undefined,
    });
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

  @Get('pricing/checkout-settings')
  async getCheckoutSettings(@CurrentUser() _user: User) {
    return this.admin.getPlatformCheckoutSettings();
  }

  @Patch('pricing/checkout-settings')
  async patchCheckoutSettings(@CurrentUser() _user: User, @Body() dto: PatchPlatformCheckoutSettingsDto) {
    return this.admin.patchPlatformCheckoutSettings(dto);
  }

  @Patch('stores/:storeId/commission-override')
  async patchStoreCommissionOverride(
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreCommissionOverrideDto,
  ) {
    return this.admin.setStoreCommissionOverride(storeId, dto.commissionPercentOverride);
  }

  @Patch('stores/:storeId/customer-price-markup')
  async patchStoreCustomerPriceMarkup(
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreCustomerMarkupDto,
  ) {
    return this.admin.setStoreCustomerPriceMarkup(storeId, dto.customerPriceMarkupPercent);
  }

  @Patch('stores/:storeId/minimum-order')
  async patchStoreMinimumOrder(
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreMinimumOrderDto,
  ) {
    return this.admin.setStoreMinimumOrderValue(storeId, dto.minimumOrderValue);
  }

  @Patch('stores/:storeId/profile')
  async patchStoreProfile(@Param('storeId') storeId: string, @Body() dto: UpdateStoreDto) {
    return this.stores.adminUpdateStoreProfile(storeId, dto);
  }

  @Patch('stores/:storeId/status')
  async patchStoreStatus(@Param('storeId') storeId: string, @Body() dto: UpdateStoreStatusDto) {
    return this.admin.setStoreStatus(storeId, dto.status);
  }

  /** Which platform tabs show this store (food / grocery / medicine). */
  @Get('stores/:storeId/platform-categories')
  async getStorePlatformCategories(@Param('storeId') storeId: string) {
    return this.admin.getStorePlatformCategories(storeId);
  }

  @Put('stores/:storeId/platform-categories')
  async putStorePlatformCategories(
    @Param('storeId') storeId: string,
    @Body() dto: SetStorePlatformCategoriesDto,
  ) {
    return this.admin.setStorePlatformCategories(storeId, dto.names);
  }

  /** Same as PUT — POST/PATCH avoid some proxies that mishandle PUT or return 404. */
  @Post('stores/:storeId/platform-categories')
  async postStorePlatformCategories(
    @Param('storeId') storeId: string,
    @Body() dto: SetStorePlatformCategoriesDto,
  ) {
    return this.admin.setStorePlatformCategories(storeId, dto.names);
  }

  @Patch('stores/:storeId/platform-categories')
  async patchStorePlatformCategories(
    @Param('storeId') storeId: string,
    @Body() dto: SetStorePlatformCategoriesDto,
  ) {
    return this.admin.setStorePlatformCategories(storeId, dto.names);
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

  @Get('stores/:storeId/products/drafts')
  async adminDraftProducts(@Param('storeId') storeId: string) {
    return this.stores.adminGetDraftProducts(storeId);
  }

  @Post('stores/:storeId/products/ingest-reference/preview')
  async ingestReferencePreview(@Param('storeId') storeId: string) {
    return this.pharmacyIngestion.previewReferenceSeed(storeId);
  }

  @Post('stores/:storeId/products/ingest-reference')
  async ingestReference(@Param('storeId') storeId: string, @Body() dto: IngestReferenceDto) {
    return this.pharmacyIngestion.ingestReferenceSeed(storeId, dto.dryRun ?? false);
  }

  @Patch('stores/:storeId/products/:productId/verify')
  async approveDraftProduct(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() dto: ApproveDraftProductDto,
  ) {
    return this.stores.adminApproveDraftProduct(storeId, productId, dto);
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

  @Get('stores/:storeId/products/:productId/variants')
  async adminListProductVariants(@Param('storeId') storeId: string, @Param('productId') productId: string) {
    return this.stores.adminListProductVariants(storeId, productId);
  }

  @Post('stores/:storeId/products/:productId/variants')
  async adminCreateProductVariant(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.stores.adminCreateProductVariant(storeId, productId, dto);
  }

  @Patch('stores/:storeId/products/:productId/variants/:variantId')
  async adminUpdateProductVariant(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.stores.adminUpdateProductVariant(storeId, productId, variantId, dto);
  }

  @Delete('stores/:storeId/products/:productId/variants/:variantId')
  async adminDeleteProductVariant(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.stores.adminDeleteProductVariant(storeId, productId, variantId);
  }
}
