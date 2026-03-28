import { Get, Post, Patch, Delete, Body, Param, Controller, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('store-owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STORE_OWNER')
export class StoreOwnerController {
  constructor(private readonly stores: StoresService) {}

  @Get('store')
  async getStore(@CurrentUser() user: User) {
    return this.stores.getStoreForOwner(user.id);
  }

  @Patch('store')
  async updateStore(@CurrentUser() user: User, @Body() dto: UpdateStoreDto) {
    return this.stores.updateStore(user.id, dto);
  }

  @Get('earnings')
  async getEarnings(@CurrentUser() user: User) {
    return this.stores.getEarnings(user.id);
  }

  @Get('categories')
  async getCategories(@CurrentUser() user: User) {
    return this.stores.getCategories(user.id);
  }

  @Post('categories')
  async createCategory(@CurrentUser() user: User, @Body() dto: CreateProductCategoryDto) {
    return this.stores.createCategory(user.id, dto);
  }

  @Patch('categories/:id')
  async updateCategory(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.stores.updateCategory(user.id, id, dto);
  }

  @Delete('categories/:id')
  async deleteCategory(@CurrentUser() user: User, @Param('id') id: string) {
    return this.stores.deleteCategory(user.id, id);
  }

  @Get('products')
  async getProducts(@CurrentUser() user: User) {
    return this.stores.getProducts(user.id);
  }

  @Post('products')
  async createProduct(@CurrentUser() user: User, @Body() dto: CreateProductDto) {
    return this.stores.createProduct(user.id, dto);
  }

  @Patch('products/:id')
  async updateProduct(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.stores.updateProduct(user.id, id, dto);
  }

  @Delete('products/:id')
  async deleteProduct(@CurrentUser() user: User, @Param('id') id: string) {
    return this.stores.deleteProduct(user.id, id);
  }

  @Patch('products/:id/out-of-stock')
  async setProductOutOfStock(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { isOutOfStock: boolean }) {
    return this.stores.setProductOutOfStock(user.id, id, body.isOutOfStock ?? false);
  }
}
