import { type DiscordOAuthScope } from '@dereekb/discord';
import { DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionOAuthServiceConfig, userExternalConnectionOAuthControllerPath, userExternalConnectionOAuthRoutesForGlobalRouteExclude, userExternalConnectionOAuthServiceConfigFactory } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';

/**
 * Controller path the Discord external-connection OAuth endpoints are mounted at.
 *
 * Derived from the framework's path factory, the same expression the redirect URI and the
 * global-prefix exclusion are built from, so the three cannot drift apart.
 */
export const DISCORD_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH = userExternalConnectionOAuthControllerPath(DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * Routes to exclude from an app's global API route prefix so the Discord callback controller stays
 * mounted at `/oauth/discord/*`.
 *
 * Spread this into the `exclude` list of the app's `globalApiRoutePrefix` config, alongside
 * `FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE`.
 */
export const DISCORD_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = userExternalConnectionOAuthRoutesForGlobalRouteExclude(DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * The scopes requested when an app does not declare its own.
 *
 * Declared in code, deliberately NOT read from the environment: the set to request follows from what
 * the integration actually does, so it is a property of the code rather than of a deployment.
 *
 * `identify` alone. It is the least-privilege scope that still makes a Discord connection meaningful
 * — a token granted no scopes can do nothing — and it is what lets the connection be labeled with the
 * account it belongs to. Excludes `email`, which is a real privilege escalation the label does not
 * need, and `guilds` / `connections` / `bot`, which nothing here reads.
 */
export const DEFAULT_DISCORD_OAUTH_SCOPES: readonly DiscordOAuthScope[] = ['identify'];

/**
 * Configuration for the {@link DiscordUserExternalConnectionOAuthService}.
 *
 * Extends the framework config with the one thing that is Discord's own — which scopes to request.
 *
 * The client credentials are NOT here: they belong to `DiscordOAuthServiceConfig` in
 * `@dereekb/discord/nestjs`, and the service reads them through the injected `DiscordOAuthApi`.
 */
export abstract class DiscordUserExternalConnectionOAuthServiceConfig extends UserExternalConnectionOAuthServiceConfig {
  readonly scopes!: readonly DiscordOAuthScope[];
}

export interface DiscordUserExternalConnectionOAuthServiceConfigFactoryConfig {
  readonly envService: FirebaseServerEnvService;
  /**
   * Path on the app URL the user is returned to after connecting, e.g. `/app/settings`.
   */
  readonly successPath: string;
  /**
   * Path on the app URL the user is returned to after a failed connect. Defaults to `successPath`.
   */
  readonly failurePath?: Maybe<string>;
  /**
   * The scopes to request. Defaults to {@link DEFAULT_DISCORD_OAUTH_SCOPES}.
   */
  readonly scopes?: Maybe<readonly DiscordOAuthScope[]>;
}

/**
 * Builds the Discord connect flow's configuration from the app's configured origins.
 *
 * Nothing here is read from the environment as a value: the redirect URI is derived from the app's
 * OAuth origin plus the mounted controller path, and the return URLs from the app URL plus
 * code-declared paths. The client credentials are read by `discordOAuthServiceConfigFactory` in
 * `@dereekb/discord/nestjs`, so registering Discord adds no deployment configuration here.
 *
 * @param config - The env service, the return paths, and the optional scope override.
 * @returns The validated service configuration.
 */
export function discordUserExternalConnectionOAuthServiceConfigFactory(config: DiscordUserExternalConnectionOAuthServiceConfigFactoryConfig): DiscordUserExternalConnectionOAuthServiceConfig {
  const { envService, successPath, failurePath, scopes } = config;

  const baseConfig = userExternalConnectionOAuthServiceConfigFactory({
    envService,
    providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    successPath,
    failurePath
  });

  return {
    ...baseConfig,
    scopes: scopes ?? DEFAULT_DISCORD_OAUTH_SCOPES
  };
}
