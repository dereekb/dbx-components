import { Module } from '@nestjs/common';
import { GuestbookModule } from './guestbook/guestbook.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [ProfileModule, NotificationModule, GuestbookModule],
  exports: [ProfileModule, NotificationModule, GuestbookModule]
})
export class DemoApiModelModule {}
