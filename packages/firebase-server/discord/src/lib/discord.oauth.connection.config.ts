import { type DiscordOAuthConfig, type DiscordOAuthFactoryConfig, type DiscordOAuthScope } from '@dereekb/discord';
import { DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionOAuthServiceConfig, userExternalConnectionOAuthControllerPath, userExternalConnectionOAuthRoutesForGlobalRouteExclude, userExternalConnectionOAuthServiceConfigFactory } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';
import { type ConfigService } from '@nestjs/config';

export const DISCORD_CLIENT_ID_CONFIG_KEY = 'DISCORD_CLIENT_ID';
export const DISCORD_CLIENT_SECRET_CONFIG_KEY = 'DISCORD_CLIENT_SECRET';

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
 * Extends the framework config with the two things that are Discord's own: which scopes to request,
 * and the client credentials.
 *
 * The credentials live here rather than on an injected api — unlike Cal.com, Discord has no NestJS
 * layer, because the connect flow needs no access-token cache and Discord's outbound bot API is
 * already served by `@dereekb/nestjs/discord`.
 */
export abstract class DiscordUserExternalConnectionOAuthServiceConfig extends UserExternalConnectionOAuthServiceConfig {
  readonly scopes!: readonly DiscordOAuthScope[];
  readonly discordOAuth!: DiscordOAuthConfig;
  /**
   * Optional configuration for the Discord OAuth client the service builds — a custom fetch handler
   * or error logger.
   */
  readonly factoryConfig?: Maybe<DiscordOAuthFactoryConfig>;
}

export interface DiscordUserExternalConnectionOAuthServiceConfigFactoryConfig {
  readonly envService: FirebaseServerEnvService;
  /**
   * Reads the Discord OAuth client credentials. These are the only two configuration keys registering
   * Discord adds; everything else is derived.
   */
  readonly configService: ConfigService;
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
  /**
   * Optional configuration for the Discord OAuth client the service builds.
   */
  readonly factoryConfig?: Maybe<DiscordOAuthFactoryConfig>;
}

/**
 * Builds the Discord connect flow's configuration from the app's configured origins plus the client
 * credentials.
 *
 * Nothing but the credentials is read from the environment: the redirect URI is derived from the app's
 * OAuth origin plus the mounted controller path, and the return URLs from the app URL plus
 * code-declared paths.
 *
 * @param config - The env service, the config service, the return paths, and the optional scope override.
 * @returns The validated service configuration.
 * @throws {Error} When either client credential is missing.
 */
export function discordUserExternalConnectionOAuthServiceConfigFactory(config: DiscordUserExternalConnectionOAuthServiceConfigFactoryConfig): DiscordUserExternalConnectionOAuthServiceConfig {
  const { envService, configService, successPath, failurePath, scopes, factoryConfig } = config;

  const baseConfig = userExternalConnectionOAuthServiceConfigFactory({
    envService,
    providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    successPath,
    failurePath
  });

  const clientId = configService.get<string>(DISCORD_CLIENT_ID_CONFIG_KEY);
  const clientSecret = configService.get<string>(DISCORD_CLIENT_SECRET_CONFIG_KEY);

  // fail at startup rather than at the consent screen: a missing client id otherwise composes an
  // authorize URL carrying `client_id=undefined`, and a missing secret fails the exchange only after
  // the user has already consented
  if (!clientId) {
    throw new Error(`DiscordUserExternalConnectionOAuthService requires a Discord OAuth client id (${DISCORD_CLIENT_ID_CONFIG_KEY}).`);
  } else if (!clientSecret) {
    throw new Error(`DiscordUserExternalConnectionOAuthService requires a Discord OAuth client secret (${DISCORD_CLIENT_SECRET_CONFIG_KEY}).`);
  }

  return {
    ...baseConfig,
    scopes: scopes ?? DEFAULT_DISCORD_OAUTH_SCOPES,
    discordOAuth: { clientId, clientSecret },
    factoryConfig
  };
}
