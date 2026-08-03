import { Module } from '@nestjs/common';
import { appDiscordUserExternalConnectionOAuthModuleMetadata } from '@dereekb/firebase-server/discord';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH, UserExternalConnectionModule } from '../../common/model/userexternalconnection';

/**
 * Mounts the Discord connect endpoints at `/oauth/discord`.
 *
 * The app supplies only where the user is returned to; the redirect URI is derived by the framework
 * from the server environment's OAuth origin and the same path the controller mounts on.
 *
 * Deliberately separate from `DemoApiDiscordModule`, which is the bot/webhook gateway integration:
 * that module imports `DiscordModule`, which asserts a `DISCORD_BOT_TOKEN`, and the per-user OAuth
 * flow has no business requiring one.
 */
@Module(
  appDiscordUserExternalConnectionOAuthModuleMetadata({
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoDiscordOAuthConnectionModule {}
