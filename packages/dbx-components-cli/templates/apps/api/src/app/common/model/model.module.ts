import { Module } from '@nestjs/common';
import { ExampleModule } from './example/example.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationModule } from './notification/notification.module';
import { StorageFileModule } from './storagefile/storagefile.module';
// @dbx-addon:oidc:api-model-module:imports

@Module({
  imports: [
    ProfileModule,
    NotificationModule,
    ExampleModule,
    StorageFileModule
    // @dbx-addon:oidc:api-model-module:modules
  ],
  exports: [
    ProfileModule,
    NotificationModule,
    ExampleModule,
    StorageFileModule
    // @dbx-addon:oidc:api-model-module:module-exports
  ]
})
export class APP_CODE_PREFIXApiModelModule {}
