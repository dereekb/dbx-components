import { Global, Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule, DemoApiModelModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';
import { DemoApiServerModule } from './server/server.module';
import { appAnalyticsModuleMetadata, FirebaseServerAnalyticsSegmentModule } from '@dereekb/firebase-server';
import { appMcpAnalyticsModuleMetadata } from '@dereekb/firebase-server/mcp';

@Global()
@Module(
  appAnalyticsModuleMetadata({
    dependencyModule: FirebaseServerAnalyticsSegmentModule
  })
)
export class DemoApiAppAnalyticsModule {}

@Global()
@Module(appMcpAnalyticsModuleMetadata())
export class DemoApiAppMcpAnalyticsModule {}

@Module({
  imports: [GlobalNotificationModule, DemoApiAppAnalyticsModule, DemoApiAppMcpAnalyticsModule],
  exports: [GlobalNotificationModule, DemoApiAppAnalyticsModule, DemoApiAppMcpAnalyticsModule]
})
export class DemoApiAppGlobalModule {}

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule, DemoApiAppGlobalModule, DemoApiServerModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule {}
