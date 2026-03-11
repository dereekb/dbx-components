import { Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule, DemoApiModelModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';
import { DemoApiServerModule } from './server/server.module';
import { ConfigureOAuthAuthMiddlewareModule, OAuthAuthMiddlewareConfig } from '@dereekb/firebase-server/oidc';

@Module({
  imports: [GlobalNotificationModule],
  exports: [GlobalNotificationModule]
})
export class DemoApiAppGlobalModule {}

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule, DemoApiAppGlobalModule, DemoApiServerModule, ConfigureOAuthAuthMiddlewareModule],
  exports: [DemoApiModelModule],
  providers: [{ provide: OAuthAuthMiddlewareConfig, useValue: { protectedPaths: ['/api/demo', '/mcp'] } }]
})
export class DemoApiAppModule {}
