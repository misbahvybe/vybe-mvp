import { Get, Post, Patch, Delete, Body, Param, Controller, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreateAddressDto } from './dto/create-address.dto';
import { AddPaymentMethodDto } from './dto/add-payment-method.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: User) {
    return this.users.getProfile(user.id);
  }

  @Get('me/addresses')
  async getAddresses(@CurrentUser() user: User) {
    return this.users.getAddresses(user.id);
  }

  @Post('me/addresses')
  async createAddress(@CurrentUser() user: User, @Body() dto: CreateAddressDto) {
    return this.users.createAddress(user.id, dto);
  }

  @Patch('me/addresses/:id')
  async updateAddress(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAddressDto>,
  ) {
    return this.users.updateAddress(user.id, id, dto);
  }

  @Delete('me/addresses/:id')
  async deleteAddress(@CurrentUser() user: User, @Param('id') id: string) {
    return this.users.deleteAddress(user.id, id);
  }

  @Get('me/payment-methods')
  async getPaymentMethods(@CurrentUser() user: User) {
    return this.users.getPaymentMethods(user.id);
  }

  @Post('me/payment-methods')
  async addPaymentMethod(@CurrentUser() user: User, @Body() dto: AddPaymentMethodDto) {
    return this.users.addPaymentMethod(user.id, dto);
  }

  @Patch('me/payment-methods/:id/default')
  async setDefaultPaymentMethod(@CurrentUser() user: User, @Param('id') id: string) {
    return this.users.setDefaultPaymentMethod(user.id, id);
  }

  @Delete('me/payment-methods/:id')
  async deletePaymentMethod(@CurrentUser() user: User, @Param('id') id: string) {
    return this.users.deletePaymentMethod(user.id, id);
  }
}
