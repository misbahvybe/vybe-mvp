import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}

