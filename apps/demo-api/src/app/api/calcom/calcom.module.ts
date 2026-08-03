import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalcomOAuthAccessTokenCacheService, appCalcomOAuthCallbackModuleMetadata, appCalcomOAuthModuleMetadata, fileCalcomOAuthAccessTokenCacheService, memoryCalcomOAuthAccessTokenCacheService, mergeCalcomOAuthAccessTokenCacheServices } from '@dereekb/calcom/nestjs';
import { DemoApiFirestoreModule } from '../../common/firebase/firestore.module';
import { UserExternalConnectionModule } from '../../common/model/userexternalconnection';
import { DemoApiCalcomOAuthService } from './calcom.oauth.service';

export const demoCalcomAccessTokenCacheServiceFactory = () => {
  const memoryCache = memoryCalcomOAuthAccessTokenCacheService();
  const fileCache = fileCalcomOAuthAccessTokenCacheService();

  return mergeCalcomOAuthAccessTokenCacheServices([memoryCache, fileCache]);
};

@Module({
  imports: [ConfigModule, DemoApiFirestoreModule],
  providers: [
    {
      provide: CalcomOAuthAccessTokenCacheService,
      useFactory: demoCalcomAccessTokenCacheServiceFactory,
      inject: []
    }
  ],
  exports: [CalcomOAuthAccessTokenCacheService]
})
export class DemoApiCalcomDependencyModule {}

@Module(appCalcomOAuthModuleMetadata({ dependencyModule: DemoApiCalcomDependencyModule }))
export class DemoCalcomOAuthModule {}

@Module(
  appCalcomOAuthCallbackModuleMetadata({
    dependencyModule: DemoCalcomOAuthModule,
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    providers: [DemoApiCalcomOAuthService],
    exports: [DemoApiCalcomOAuthService]
  })
)
export class DemoCalcomOAuthCallbackModule {}

@Module({
  imports: [DemoCalcomOAuthCallbackModule],
  exports: [DemoCalcomOAuthCallbackModule]
})
export class DemoApiCalcomModule {}
