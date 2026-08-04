import { Module } from '@nestjs/common';
import { appZohoAccountsOAuthModuleMetadata } from '@dereekb/zoho/nestjs';
import { appZohoUserExternalConnectionOAuthModuleMetadata } from '@dereekb/firebase-server/zoho';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH, UserExternalConnectionModule } from '../../common/model/userexternalconnection';

/**
 * The per-user Zoho OAuth client.
 *
 * No dependency module and no `ZohoAccountsAccessTokenCacheService`: that cache holds the
 * SERVER-to-server token, and a per-user connect has no server token to cache. The existing
 * `firebaseZohoAccountsAccessTokenCacheService` is untouched by this.
 */
@Module(appZohoAccountsOAuthModuleMetadata({}))
export class DemoZohoAccountsOAuthModule {}

/**
 * Mounts the Zoho connect endpoints at `/oauth/zoho`.
 *
 * The app supplies only where the user is returned to; the redirect URI is derived by the framework
 * from the server environment's OAuth origin and the same path the controller mounts on.
 */
@Module(
  appZohoUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: DemoZohoAccountsOAuthModule,
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoZohoOAuthCallbackModule {}

@Module({
  imports: [DemoZohoOAuthCallbackModule],
  exports: [DemoZohoOAuthCallbackModule]
})
export class DemoApiZohoModule {}
