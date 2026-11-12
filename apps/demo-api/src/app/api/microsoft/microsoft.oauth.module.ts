import { Module } from '@nestjs/common';
import { appMicrosoftOAuthModuleMetadata } from '@dereekb/microsoft/nestjs';
import { appMicrosoftUserExternalConnectionOAuthModuleMetadata } from '@dereekb/firebase-server/microsoft';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH, UserExternalConnectionModule } from '../../common/model/userexternalconnection';

/**
 * The demo's single-tenant Microsoft OAuth client, read from `MICROSOFT_OAUTH_CLIENT_ID`,
 * `MICROSOFT_OAUTH_CLIENT_SECRET` and `MICROSOFT_OAUTH_TENANT`.
 */
@Module(appMicrosoftOAuthModuleMetadata({}))
export class DemoMicrosoftOAuthModule {}

/**
 * The `microsoft` connection, connected with the default Read / Read + Write scope presets.
 */
@Module(
  appMicrosoftUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: DemoMicrosoftOAuthModule,
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoMicrosoftOAuthConnectionModule {}

@Module({
  imports: [DemoMicrosoftOAuthConnectionModule],
  exports: [DemoMicrosoftOAuthConnectionModule]
})
export class DemoApiMicrosoftModule {}
