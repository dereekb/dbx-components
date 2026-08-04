import { ZOHO_ACCOUNTS_PROFILE_READ_SCOPE, type ZohoAccountsConfigApiUrlInput, type ZohoOAuthScope } from '@dereekb/zoho';
import { ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionOAuthServiceConfig, userExternalConnectionOAuthControllerPath, userExternalConnectionOAuthRoutesForGlobalRouteExclude, userExternalConnectionOAuthServiceConfigFactory } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';

/**
 * Controller path the Zoho external-connection OAuth endpoints are mounted at.
 *
 * Derived from the framework's path factory, the same expression the redirect URI and the
 * global-prefix exclusion are built from, so the three cannot drift apart.
 */
export const ZOHO_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH = userExternalConnectionOAuthControllerPath(ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * Routes to exclude from an app's global API route prefix so the Zoho callback controller stays
 * mounted at `/oauth/zoho/*`.
 *
 * Spread this into the `exclude` list of the app's `globalApiRoutePrefix` config, alongside
 * `FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE`.
 */
export const ZOHO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = userExternalConnectionOAuthRoutesForGlobalRouteExclude(ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * The scopes requested when an app does not declare its own.
 *
 * Declared in code, deliberately NOT read from the environment: the set to request follows from what
 * the integration actually does, so it belongs where it is reviewable.
 *
 * Least privilege for a connect that proves the handoff and labels the connection: read the
 * authorizing user's Zoho identity, and nothing else. No `ZohoCRM.*` / `ZohoRecruit.*` scope is
 * requested because the default integration makes no product API call — requesting one would be
 * privilege the code never uses, which is the same error as under-requesting, in the other
 * direction. An app that actually calls a Zoho product declares its own set on the module metadata,
 * in code.
 *
 * Unlike Cal.com, Zoho does not pre-register scopes on the OAuth client, so nothing has to be
 * registered in the API console to request this.
 */
export const DEFAULT_ZOHO_OAUTH_SCOPES: readonly ZohoOAuthScope[] = [ZOHO_ACCOUNTS_PROFILE_READ_SCOPE];

/**
 * Configuration for the {@link ZohoUserExternalConnectionOAuthService}.
 *
 * Extends the framework config with what is Zoho's own: which scopes to request, and which
 * datacenter to authorize against.
 */
export abstract class ZohoUserExternalConnectionOAuthServiceConfig extends UserExternalConnectionOAuthServiceConfig {
  readonly scopes!: readonly ZohoOAuthScope[];
  /**
   * Datacenter to authorize against. Defaults to the api's configured one.
   */
  readonly accountsApiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
}

export interface ZohoUserExternalConnectionOAuthServiceConfigFactoryConfig {
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
   * The scopes to request. Defaults to {@link DEFAULT_ZOHO_OAUTH_SCOPES}.
   */
  readonly scopes?: Maybe<readonly ZohoOAuthScope[]>;
  /**
   * Datacenter to authorize against. Defaults to the api's configured one.
   */
  readonly accountsApiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
}

/**
 * Builds the Zoho connect flow's configuration from the app's configured origins.
 *
 * Nothing here is read from the environment as a value: the redirect URI is derived from the app's
 * OAuth origin plus the mounted controller path, and the return URLs from the app URL plus
 * code-declared paths. Registering Zoho therefore adds no deployment configuration beyond the client
 * credentials the OAuth api already reads.
 *
 * @param config - The env service, the return paths, and the optional scope/datacenter overrides.
 * @returns The validated service configuration.
 */
export function zohoUserExternalConnectionOAuthServiceConfigFactory(config: ZohoUserExternalConnectionOAuthServiceConfigFactoryConfig): ZohoUserExternalConnectionOAuthServiceConfig {
  const { envService, successPath, failurePath, scopes, accountsApiUrl } = config;

  const baseConfig = userExternalConnectionOAuthServiceConfigFactory({
    envService,
    providerType: ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    successPath,
    failurePath
  });

  return {
    ...baseConfig,
    scopes: scopes ?? DEFAULT_ZOHO_OAUTH_SCOPES,
    accountsApiUrl
  };
}
