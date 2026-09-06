import { Module } from '@nestjs/common';
import { appDiscordOAuthModuleMetadata } from '@dereekb/discord/nestjs';
import { appDiscordUserExternalConnectionOAuthModuleMetadata } from '@dereekb/firebase-server/discord';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_SIGN_IN_FAILURE_PATH, DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH, UserExternalConnectionModule } from '../../common/model/userexternalconnection';

/**
 * Provides {@link DiscordOAuthApi}, the app's Discord OAuth client.
 *
 * Takes no dependency module of its own, unlike the Cal.com equivalent: the Discord OAuth api needs no
 * access-token cache service, since the external-connection framework persists each user's credentials.
 */
@Module(appDiscordOAuthModuleMetadata({}))
export class DemoDiscordOAuthModule {}

/**
 * Mounts the Discord connect AND sign-in endpoints at `/oauth/discord`.
 *
 * The app supplies only where the user is returned to; the redirect URI is derived by the framework
 * from the server environment's OAuth origin and the same path the controller mounts on.
 *
 * Deliberately separate from `DemoApiDiscordModule`, which is the bot/webhook gateway integration:
 * that module imports `DiscordModule`, which asserts a `DISCORD_BOT_TOKEN`, and the per-user OAuth
 * flow has no business requiring one.
 *
 * Whether the sign-in routes actually answer is decided in `UserExternalConnectionModule`, by the
 * Discord provider policy and the registered sign-in service — the paths below only say where a
 * sign-in lands.
 */
@Module(
  appDiscordUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: DemoDiscordOAuthModule,
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH,
    signInSuccessPath: DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH,
    signInFailurePath: DEMO_EXTERNAL_CONNECTION_SIGN_IN_FAILURE_PATH,
    // the only paths a sign-in request may ask to be returned to instead of the default; an exact
    // match, so anything else is dropped rather than honored
    allowedReturnPaths: [DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH],
    // the default `['identify']` reports NO email, which both fails the demo delegate's verified-email
    // requirement and silently skips the sign-in service's existing-account collision check
    scopes: ['identify', 'email']
  })
)
export class DemoDiscordOAuthConnectionModule {}
