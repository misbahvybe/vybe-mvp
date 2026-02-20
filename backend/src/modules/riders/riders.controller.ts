import { Get, Patch, Body, Controller, UseGuards } from '@nestjs/common';
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
}
