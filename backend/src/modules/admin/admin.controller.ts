import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { StoresService } from '../stores/stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { multerImageFileOptions, publicUploadedImageUrl } from '../../common/uploads/image-multer';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreateProductCategoryDto } from '../stores/dto/create-product-category.dto';
import { UpdateProductCategoryDto } from '../stores/dto/update-product-category.dto';
import { CreateProductDto } from '../stores/dto/create-product.dto';
import { UpdateProductDto } from '../stores/dto/update-product.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly stores: StoresService,
  ) {}

  /** Product / store images for admin web PWA (same disk path as store-owner uploads). */
  @Post('uploads/image')
  @UseInterceptors(FileInterceptor('file', multerImageFileOptions()))
  uploadMenuImage(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Upload a JPEG, PNG, GIF, or WebP image (max 5 MB)');
    }
    return { imageUrl: publicUploadedImageUrl(req, file.filename) };
  }

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
