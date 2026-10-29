import { TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE, TRELLO_OAUTH_READ_MEMBER_SCOPE, type TrelloOAuthScope } from '@dereekb/trello';
import { TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionOAuthServiceConfig, userExternalConnectionOAuthControllerPath, userExternalConnectionOAuthRoutesForGlobalRouteExclude, userExternalConnectionOAuthServiceConfigFactory } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';

/**
 * Controller path the default Trello external-connection OAuth endpoints are mounted at.
 *
 * Derived from the framework's path factory, the same expression the redirect URI and the
 * global-prefix exclusion are built from, so the three cannot drift apart.
 */
export const TRELLO_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH = userExternalConnectionOAuthControllerPath(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * Routes to exclude from an app's global API route prefix so the default Trello callback controller
 * stays mounted at `/oauth/trello/*`.
 *
 * Another Trello instance excludes its own with
 * `userExternalConnectionOAuthRoutesForGlobalRouteExclude(providerType)`.
 */
export const TRELLO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = userExternalConnectionOAuthRoutesForGlobalRouteExclude(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * The scopes requested when an app does not declare its own.
 *
 * Declared in code, deliberately NOT read from the environment: the set to request follows from what
 * the integration actually does, so it is a property of the code rather than of a deployment.
 *
 * Least privilege: `read:member:trello` to identify the member the connection belongs to, and
 * `offline_access` to keep refreshing it. An app that reads or writes boards declares the board scopes
 * itself — they are "workspace restricted", so the consent screen may bind the grant to one Trello
 * workspace.
 */
export const DEFAULT_TRELLO_OAUTH_SCOPES: readonly TrelloOAuthScope[] = [TRELLO_OAUTH_READ_MEMBER_SCOPE, TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE];

/**
 * Configuration for the {@link TrelloUserExternalConnectionOAuthService}.
 *
 * Extends the framework config with the one thing that is Trello's own — which scopes to request.
 *
 * The client credentials are NOT here: they belong to `TrelloOAuthServiceConfig` in
 * `@dereekb/trello/nestjs`, and the service reads them through the injected `TrelloOAuthApi`.
 */
export abstract class TrelloUserExternalConnectionOAuthServiceConfig extends UserExternalConnectionOAuthServiceConfig {
  /**
   * The scopes requested on every handoff.
   */
  readonly scopes!: readonly TrelloOAuthScope[];
}

export interface TrelloUserExternalConnectionOAuthServiceConfigFactoryConfig {
  readonly envService: FirebaseServerEnvService;
  /**
   * The provider type this Trello connection is stored and routed under. Defaults to
   * {@link TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE}.
   *
   * Set when an app registers more than one Trello connection, e.g. a member's own `trello` connection
   * and a `trello_bot` connection to the account a bot acts as.
   */
  readonly providerType?: Maybe<UserExternalConnectionProviderType>;
  /**
   * Path on the app URL the user is returned to after connecting, e.g. `/app/settings`.
   */
  readonly successPath: string;
  /**
   * Path on the app URL the user is returned to after a failed connect. Defaults to `successPath`.
   */
  readonly failurePath?: Maybe<string>;
  /**
   * Path on the app URL a successful SIGN-IN returns to. Defaults to `successPath`.
   */
  readonly signInSuccessPath?: Maybe<string>;
  /**
   * Path on the app URL a FAILED sign-in returns to. Defaults to `failurePath`.
   */
  readonly signInFailurePath?: Maybe<string>;
  /**
   * App paths a sign-in request may ask to return to instead of `signInSuccessPath`.
   */
  readonly allowedReturnPaths?: Maybe<readonly string[]>;
  /**
   * The scopes to request. Defaults to {@link DEFAULT_TRELLO_OAUTH_SCOPES}.
   */
  readonly scopes?: Maybe<readonly TrelloOAuthScope[]>;
}

/**
 * Builds the Trello connect flow's configuration from the app's configured origins.
 *
 * Nothing here is read from the environment as a value: the redirect URI is derived from the app's
 * OAuth origin plus the mounted controller path, and the return URLs from the app URL plus
 * code-declared paths. The client credentials are read by `trelloOAuthServiceConfigFactory` in
 * `@dereekb/trello/nestjs`.
 *
 * Every sign-in path is passed through even though Trello sign-in is not wired by default, so enabling
 * it later needs no change here.
 *
 * @param config - The env service, the provider type, the return paths, and the optional scopes.
 * @returns The validated service configuration.
 */
export function trelloUserExternalConnectionOAuthServiceConfigFactory(config: TrelloUserExternalConnectionOAuthServiceConfigFactoryConfig): TrelloUserExternalConnectionOAuthServiceConfig {
  const { envService, providerType, successPath, failurePath, signInSuccessPath, signInFailurePath, allowedReturnPaths, scopes } = config;

  const baseConfig = userExternalConnectionOAuthServiceConfigFactory({
    envService,
    providerType: providerType ?? TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    successPath,
    failurePath,
    signInSuccessPath,
    signInFailurePath,
    allowedReturnPaths
  });

  return {
    ...baseConfig,
    scopes: scopes ?? DEFAULT_TRELLO_OAUTH_SCOPES
  };
}
