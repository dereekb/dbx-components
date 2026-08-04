import { Module } from '@nestjs/common';
import { GuestbookModule } from './guestbook/guestbook.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationModule } from './notification/notification.module';
import { OidcModelModule } from './oidc/oidc.module';
import { StorageFileModule } from './storagefile/storagefile.module';
import { UserExternalConnectionModule } from './userexternalconnection/userexternalconnection.module';

@Module({
  imports: [ProfileModule, NotificationModule, GuestbookModule, StorageFileModule, OidcModelModule, UserExternalConnectionModule],
  exports: [ProfileModule, NotificationModule, GuestbookModule, StorageFileModule, OidcModelModule, UserExternalConnectionModule]
})
export class DemoApiModelModule {}
