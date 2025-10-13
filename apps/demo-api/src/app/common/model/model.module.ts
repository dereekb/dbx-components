import { Module } from '@nestjs/common';
import { GuestbookModule } from './guestbook/guestbook.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationModule } from './notification/notification.module';
import { StorageFileModule } from './storagefile/storagefile.module';

@Module({
  imports: [ProfileModule, NotificationModule, GuestbookModule, StorageFileModule],
  exports: [ProfileModule, NotificationModule, GuestbookModule, StorageFileModule]
})
export class DemoApiModelModule {}
