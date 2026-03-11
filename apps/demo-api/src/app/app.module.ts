import { Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule, DemoApiModelModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';
import { DemoApiServerModule } from './server/server.module';

@Module({
  imports: [GlobalNotificationModule],
  exports: [GlobalNotificationModule]
})
export class DemoApiAppGlobalModule {}

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule, DemoApiAppGlobalModule, DemoApiServerModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule {}
