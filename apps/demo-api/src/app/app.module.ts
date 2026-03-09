import { Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule, DemoApiModelModule, DemoApiOAuthModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';

@Module({
  imports: [GlobalNotificationModule],
  exports: [GlobalNotificationModule]
})
export class DemoApiAppGlobalModule {}

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule, DemoApiAppGlobalModule, DemoApiOAuthModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule {}
