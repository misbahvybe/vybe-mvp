import { Get, Patch, Body, Controller, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { RidersService } from './riders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RIDER')
export class RidersController {
  constructor(private readonly riders: RidersService) {}

  @Get('me')
  async getDashboard(@CurrentUser() user: User) {
    return this.riders.getDashboard(user.id);
  }

  @Patch('me')
  async setAvailable(@CurrentUser() user: User, @Body() body: { isAvailable: boolean }) {
    return this.riders.setAvailable(user.id, body.isAvailable ?? true);
  }

  @Get('me/earnings')
  async getEarnings(@CurrentUser() user: User) {
    return this.riders.getEarnings(user.id);
  }

  @Get('me/available-orders')
  async availableOrders(
    @CurrentUser() user: User,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    return this.riders.findAvailableOrdersNear(user.id, latitude, longitude);
  }

  @Patch('me/location')
  async setLocation(
    @CurrentUser() user: User,
    @Body() body: { latitude: number; longitude: number },
  ) {
    const la = Number(body?.latitude);
    const lo = Number(body?.longitude);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      throw new BadRequestException('latitude and longitude are required');
    }
    return this.riders.updateLocation(user.id, la, lo);
  }
}
