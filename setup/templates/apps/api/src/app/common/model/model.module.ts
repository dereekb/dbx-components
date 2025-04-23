import { Module } from "@nestjs/common";
import { ExampleModule } from "./example/example.module";
import { ProfileModule } from "./profile/profile.module";
import { NotificationModule } from "./notification/notification.module";

@Module({
  imports: [ProfileModule, NotificationModule, ExampleModule],
  exports: [ProfileModule, NotificationModule, ExampleModule]
})
export class APP_CODE_PREFIXApiModelModule { }
