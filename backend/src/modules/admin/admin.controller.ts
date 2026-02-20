import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreatePartnerDto } from './dto/create-partner.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
}
