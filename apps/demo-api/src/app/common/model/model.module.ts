import { Module } from '@nestjs/common';
import { GuestbookModule } from './guestbook/guestbook.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationModule } from './notification/notification.module';
import { OidcModelModule } from './oidc/oidc.module';
import { StorageFileModule } from './storagefile/storagefile.module';
import { DemoAnalyticsModule } from './analytics/demo.analytics.module';

@Module({
  imports: [ProfileModule, NotificationModule, GuestbookModule, StorageFileModule, OidcModelModule, DemoAnalyticsModule],
  exports: [ProfileModule, NotificationModule, GuestbookModule, StorageFileModule, OidcModelModule, DemoAnalyticsModule]
})
export class DemoApiModelModule {}
