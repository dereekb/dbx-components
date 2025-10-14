import { Module } from "@nestjs/common";
import { ExampleModule } from "./example/example.module";
import { ProfileModule } from "./profile/profile.module";
import { NotificationModule } from "./notification/notification.module";
import { StorageFileModule } from './storagefile/storagefile.module';

@Module({
  imports: [ProfileModule, NotificationModule, ExampleModule, StorageFileModule],
  exports: [ProfileModule, NotificationModule, ExampleModule, StorageFileModule]
})
export class APP_CODE_PREFIXApiModelModule { }
