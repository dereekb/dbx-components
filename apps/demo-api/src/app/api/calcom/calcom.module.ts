import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalcomOAuthAccessTokenCacheService, appCalcomModuleMetadata, appCalcomOAuthModuleMetadata, fileCalcomOAuthAccessTokenCacheService, memoryCalcomOAuthAccessTokenCacheService, mergeCalcomOAuthAccessTokenCacheServices } from '@dereekb/calcom/nestjs';
import { UserExternalConnectionCalcomUserContextService, appCalcomUserExternalConnectionOAuthModuleMetadata, userExternalConnectionCalcomUserContextServiceProvider } from '@dereekb/firebase-server/calcom';
import { DemoApiFirestoreModule } from '../../common/firebase/firestore.module';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH, UserExternalConnectionModule } from '../../common/model/userexternalconnection';

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

/**
 * Mounts the Cal.com connect endpoints at `/oauth/calcom`.
 *
 * The app supplies only where the user is returned to; the redirect URI is derived by the framework
 * from the server environment's OAuth origin and the same path the controller mounts on.
 */
@Module(
  appCalcomUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: DemoCalcomOAuthModule,
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoCalcomOAuthCallbackModule {}

/**
 * Provides {@link CalcomApi}, the outbound half of the integration.
 *
 * Separate from the connect flow: mounting the connect endpoints does not imply the app makes Cal.com
 * calls, and making calls does not require the endpoints.
 */
@Module(appCalcomModuleMetadata({ dependencyModule: DemoCalcomOAuthModule }))
export class DemoCalcomApiModule {}

/**
 * Provides {@link UserExternalConnectionCalcomUserContextService} — a uid in, a Cal.com API instance
 * acting as that user out.
 *
 * The one module that can declare it, since it is the only place `CalcomApi` and the
 * UserExternalConnection accessor and actions are visible together.
 */
@Module({
  imports: [DemoCalcomApiModule, UserExternalConnectionModule],
  providers: [userExternalConnectionCalcomUserContextServiceProvider()],
  exports: [UserExternalConnectionCalcomUserContextService]
})
export class DemoCalcomUserContextModule {}

@Module({
  imports: [DemoCalcomOAuthCallbackModule, DemoCalcomUserContextModule],
  exports: [DemoCalcomOAuthCallbackModule, DemoCalcomUserContextModule]
})
export class DemoApiCalcomModule {}
