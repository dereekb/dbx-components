import { ZoomWebhookModule , fileZoomOAuthAccessTokenCacheService, memoryZoomOAuthAccessTokenCacheService, appZoomOAuthModuleMetadata, mergeZoomOAuthAccessTokenCacheServices, ZoomOAuthAccessTokenCacheService, appZoomModuleMetadata } from '@dereekb/zoom/nestjs';
import { Module } from '@nestjs/common';
import { DemoApiFirestoreModule } from '../../common/firebase/firestore.module';
import { DemoApiZoomWebhookService } from './zoom.webhook.service';
import { DemoZoomService } from './zoom.service';

export const demoZoomAccountsAccessTokenCacheServiceFactory = () => {
  const memoryCache = memoryZoomOAuthAccessTokenCacheService();
  const fileCache = fileZoomOAuthAccessTokenCacheService();

  const service = mergeZoomOAuthAccessTokenCacheServices([memoryCache, fileCache]);

  return service;
};

@Module({
  imports: [DemoApiFirestoreModule],
  providers: [
    {
      provide: ZoomOAuthAccessTokenCacheService,
      useFactory: demoZoomAccountsAccessTokenCacheServiceFactory,
      inject: []
    }
  ],
  exports: [ZoomOAuthAccessTokenCacheService]
})
export class DemoApiZoomDependencyModule {}

@Module(appZoomOAuthModuleMetadata({ dependencyModule: DemoApiZoomDependencyModule }))
export class DemoZoomOAuthModule {}

@Module(appZoomModuleMetadata({ dependencyModule: DemoZoomOAuthModule }))
export class DemoZoomModule {}

@Module({
  imports: [DemoZoomModule, ZoomWebhookModule],
  providers: [DemoZoomService, DemoApiZoomWebhookService],
  exports: [DemoZoomService]
})
export class DemoApiZoomModule {}
