import { Module } from '@nestjs/common';
import { TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE, TRELLO_OAUTH_READ_BOARD_SCOPE, TRELLO_OAUTH_READ_MEMBER_SCOPE, TRELLO_OAUTH_WRITE_BOARD_SCOPE, type TrelloOAuthScope } from '@dereekb/trello';
import { appTrelloOAuthModuleMetadata } from '@dereekb/trello/nestjs';
import { appTrelloUserExternalConnectionOAuthModuleMetadata } from '@dereekb/firebase-server/trello';
import { DEMO_TRELLO_BOT_EXTERNAL_CONNECTION_PROVIDER_TYPE } from 'demo-firebase';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH, UserExternalConnectionModule } from '../../common/model/userexternalconnection';

/**
 * Trello scopes the `trello_bot` connection requests: exactly what a board loop uses — read and write
 * the boards it works, read the member it acts as, and keep refreshing.
 *
 * The board scopes are "workspace restricted", so the consent screen may bind the grant to one Trello
 * workspace: the bot must pick the workspace the loop's board lives in.
 */
export const DEMO_TRELLO_BOT_OAUTH_SCOPES: readonly TrelloOAuthScope[] = [TRELLO_OAUTH_READ_BOARD_SCOPE, TRELLO_OAUTH_WRITE_BOARD_SCOPE, TRELLO_OAUTH_READ_MEMBER_SCOPE, TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE];

/**
 * The demo's Trello OAuth 2.0 client, shared by both Trello connections.
 *
 * Reads `TRELLO_OAUTH_CLIENT_ID` / `TRELLO_OAUTH_CLIENT_SECRET`.
 */
@Module(appTrelloOAuthModuleMetadata({}))
export class DemoTrelloOAuthModule {}

/**
 * Mounts the Trello connect endpoints at `/oauth/trello`: a member's own Trello account, with the
 * adapter's least-privilege default scopes.
 */
@Module(
  appTrelloUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: DemoTrelloOAuthModule,
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoTrelloOAuthConnectionModule {}

/**
 * Mounts the BOT Trello connect endpoints at `/oauth/trello_bot`: a second Trello connection with its
 * own consent and the {@link DEMO_TRELLO_BOT_OAUTH_SCOPES}, to the account a board bot acts as. Its
 * access token can be minted out through `DemoExternalConnectionTokenApiModule`.
 *
 * Same Trello OAuth client as {@link DemoTrelloOAuthConnectionModule} (one shared
 * {@link DemoTrelloOAuthModule}), so its redirect URI `<oauth origin>/oauth/trello_bot/callback` MUST be
 * registered on that client at `trello.com/apps/admin`, alongside `/oauth/trello/callback`. Its routes
 * are excluded from the global `/api` prefix in `app.ts`, and its service is registered with the OAuth
 * registry in `api.module.ts` under `trelloUserExternalConnectionOAuthServiceToken('trello_bot')`.
 */
@Module(
  appTrelloUserExternalConnectionOAuthModuleMetadata({
    providerType: DEMO_TRELLO_BOT_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    scopes: DEMO_TRELLO_BOT_OAUTH_SCOPES,
    dependencyModule: DemoTrelloOAuthModule,
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoTrelloBotOAuthConnectionModule {}

@Module({
  imports: [DemoTrelloOAuthConnectionModule, DemoTrelloBotOAuthConnectionModule],
  exports: [DemoTrelloOAuthConnectionModule, DemoTrelloBotOAuthConnectionModule]
})
export class DemoApiTrelloModule {}
