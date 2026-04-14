import { Controller, Get, Patch, Query, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('take') take?: string,
  ) {
    const takeN = take != null ? Number(take) : undefined;
    return this.notifications.listForUser(user.id, {
      unreadOnly: unreadOnly === 'true',
      take: Number.isFinite(takeN as number) ? (takeN as number) : undefined,
    });
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.id);
  }
}

