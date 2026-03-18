import { Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule, DemoApiModelModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';
import { DemoApiServerModule } from './server/server.module';
import { appAnalyticsModuleMetadata, FirebaseServerAnalyticsSegmentModule } from '@dereekb/firebase-server';

@Module(
  appAnalyticsModuleMetadata({
    dependencyModule: FirebaseServerAnalyticsSegmentModule
  })
)
export class DemoApiAppAnalyticsModule {}

@Module({
  imports: [GlobalNotificationModule, DemoApiAppAnalyticsModule],
  exports: [GlobalNotificationModule, DemoApiAppAnalyticsModule]
})
export class DemoApiAppGlobalModule {}

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule, DemoApiAppGlobalModule, DemoApiServerModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule {}
