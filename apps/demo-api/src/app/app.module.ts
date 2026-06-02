import { Global, Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule, DemoApiModelModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';
import { DemoApiServerModule } from './server/server.module';
import { appAnalyticsModuleMetadata, FirebaseServerAnalyticsSegmentModule } from '@dereekb/firebase-server';
import { appMcpAnalyticsModuleMetadata } from '@dereekb/firebase-server/mcp';
import { appOidcAnalyticsModuleMetadata } from '@dereekb/firebase-server/oidc';

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

@Global()
@Module(appOidcAnalyticsModuleMetadata())
export class DemoApiAppOidcAnalyticsModule {}

@Module({
  imports: [GlobalNotificationModule, DemoApiAppAnalyticsModule, DemoApiAppMcpAnalyticsModule, DemoApiAppOidcAnalyticsModule],
  exports: [GlobalNotificationModule, DemoApiAppAnalyticsModule, DemoApiAppMcpAnalyticsModule, DemoApiAppOidcAnalyticsModule]
})
export class DemoApiAppGlobalModule {}

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule, DemoApiAppGlobalModule, DemoApiServerModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule {}
