import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { CalcomOAuthAccessTokenCacheService, appCalcomOAuthCallbackModuleMetadata, appCalcomOAuthModuleMetadata, fileCalcomOAuthAccessTokenCacheService, memoryCalcomOAuthAccessTokenCacheService, mergeCalcomOAuthAccessTokenCacheServices } from '@dereekb/calcom/nestjs';
import { DemoApiFirestoreModule } from '../../common/firebase/firestore.module';
import { UserExternalConnectionModule } from '../../common/model/userexternalconnection/userexternalconnection.module';
import { DemoApiCalcomOAuthService } from './calcom.oauth.service';
import { DemoApiCalcomOAuthStateCoder, demoApiCalcomOAuthStateCoderFactory } from './calcom.config';

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
    },
    {
      provide: DemoApiCalcomOAuthStateCoder,
      useFactory: demoApiCalcomOAuthStateCoderFactory,
      inject: [ConfigService, FirebaseServerEnvService]
    }
  ],
  exports: [CalcomOAuthAccessTokenCacheService, DemoApiCalcomOAuthStateCoder]
})
export class DemoApiCalcomDependencyModule {}

@Module(appCalcomOAuthModuleMetadata({ dependencyModule: DemoApiCalcomDependencyModule }))
export class DemoCalcomOAuthModule {}

@Module(
  appCalcomOAuthCallbackModuleMetadata({
    dependencyModule: DemoCalcomOAuthModule,
    imports: [DemoApiCalcomDependencyModule, UserExternalConnectionModule],
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
