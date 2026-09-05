import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';

// MARK: Paths
/**
 * Controller path a provider's external-connection OAuth endpoints are mounted at.
 *
 * Matches the Angular registry's `DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY`, which builds
 * `/oauth/<providerType>/authorize`.
 *
 * @param providerType - The provider to build a controller path for.
 * @returns The controller path, without a leading slash.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionOAuthControllerPath(providerType: UserExternalConnectionProviderType): string {
  return `oauth/${providerType}`;
}

/**
 * Routes to exclude from an app's global API route prefix so a provider's callback controller stays
 * mounted at `/oauth/<providerType>/*`.
 *
 * Spread the result into the `exclude` list of the app's `globalApiRoutePrefix` config, alongside
 * `FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE`. Without it an `/api` prefix moves the
 * routes to `/api/oauth/<providerType>/*`, which no longer matches the redirect URI registered with
 * the provider — and providers require a byte-identical match, so this is not something they
 * tolerate.
 *
 * @param providerType - The provider whose routes should be excluded.
 * @returns The route patterns to exclude.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionOAuthRoutesForGlobalRouteExclude(providerType: UserExternalConnectionProviderType): string[] {
  // the wildcard already covers `authorize`, `callback`, `signin`, and `token` — every route the
  // abstract controller mounts, present and future
  return [`${userExternalConnectionOAuthControllerPath(providerType)}/{*path}`];
}

export interface UserExternalConnectionOAuthRedirectUriInput {
  /**
   * The origin the OAuth endpoints are reachable at, e.g. `https://example.com`.
   */
  readonly origin: WebsiteUrl;
  readonly providerType: UserExternalConnectionProviderType;
}

/**
 * Builds the redirect URI to register with a provider.
 *
 * Derived from {@link userExternalConnectionOAuthControllerPath}, the same expression the controller
 * mounts on, so the registered URI cannot drift from the route that serves it.
 *
 * @param input - The origin and the provider.
 * @returns The redirect URI.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionOAuthRedirectUri(input: UserExternalConnectionOAuthRedirectUriInput): WebsiteUrl {
  const { origin, providerType } = input;
  return `${origin.replace(/\/+$/, '')}/${userExternalConnectionOAuthControllerPath(providerType)}/callback`;
}

// MARK: Config
export interface UserExternalConnectionOAuthApiConfig {
  /**
   * The provider this flow connects.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The redirect URI registered on the provider's OAuth client.
   *
   * Must match the registered value byte-for-byte, including the port, since it is sent on both the
   * authorize redirect and the token exchange.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * Where the user is sent after a connection succeeds.
   */
  readonly successUrl: WebsiteUrl;
  /**
   * Where the user is sent after a connection fails. Defaults to the `successUrl`.
   */
  readonly failureUrl?: Maybe<WebsiteUrl>;
  /**
   * Where the user is sent after a successful SIGN-IN, with the ticket appended. Defaults to the
   * `successUrl`.
   *
   * Usually different from `successUrl`: a connect returns to a settings page, a sign-in returns to
   * wherever a freshly signed-in user belongs.
   */
  readonly signInSuccessUrl?: Maybe<WebsiteUrl>;
  /**
   * App paths a sign-in request may ask to return to.
   *
   * An UNVALIDATED return path is an open redirect, so a path absent from this list is dropped and
   * the sign-in returns to {@link signInSuccessUrl} instead. Absent or empty means no request-supplied
   * return path is honored at all, which is the safe default.
   */
  readonly allowedReturnPaths?: Maybe<readonly string[]>;
}

/**
 * Returns whether a request-supplied return path may be honored.
 *
 * An exact match against the app's declared list — deliberately not a prefix or pattern match, since
 * every "starts with /app" style check ever written has eventually been defeated by a path that also
 * starts with it (`/app.evil.com`, `//evil.com/app`).
 *
 * @param config - The provider's OAuth config carrying the allowlist.
 * @param returnPath - The path the request asked to return to.
 * @returns True when the path is on the allowlist.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isAllowedUserExternalConnectionReturnPath(config: UserExternalConnectionOAuthApiConfig, returnPath: Maybe<string>): boolean {
  return returnPath != null && (config.allowedReturnPaths ?? []).includes(returnPath);
}

/**
 * Configuration for an {@link AbstractUserExternalConnectionOAuthService}.
 *
 * Provided privately by each provider's module, so two registered providers never collide on this
 * token.
 */
export abstract class UserExternalConnectionOAuthServiceConfig {
  readonly userExternalConnectionOAuth!: UserExternalConnectionOAuthApiConfig;

  static assertValidConfig(config: UserExternalConnectionOAuthServiceConfig) {
    const { userExternalConnectionOAuth } = config;

    if (!userExternalConnectionOAuth) {
      throw new Error('UserExternalConnectionOAuthServiceConfig.userExternalConnectionOAuth is required');
    }

    const { providerType, redirectUri, successUrl } = userExternalConnectionOAuth;

    if (!providerType) {
      throw new Error('UserExternalConnectionOAuthServiceConfig requires a providerType.');
    }

    if (!redirectUri) {
      throw new Error(`UserExternalConnectionOAuthServiceConfig for "${providerType}" requires a redirectUri.`);
    }

    if (!successUrl) {
      throw new Error(`UserExternalConnectionOAuthServiceConfig for "${providerType}" requires a successUrl.`);
    }

    // a redirect URI that does not resolve to the mounted callback route is otherwise undetectable
    // until the provider rejects it, since the provider compares it byte-for-byte
    const expectedPath = `/${userExternalConnectionOAuthControllerPath(providerType)}/callback`;
    const actualPath = new URL(redirectUri).pathname;

    if (actualPath !== expectedPath) {
      throw new Error(`UserExternalConnectionOAuthServiceConfig for "${providerType}" has a redirectUri of "${redirectUri}", whose path "${actualPath}" does not match the mounted callback route "${expectedPath}".`);
    }
  }
}

export interface UserExternalConnectionOAuthServiceConfigFactoryConfig {
  /**
   * Used to resolve the OAuth origin and the app URL. No part of this configuration is read from the
   * environment as a value — only the origins the app is already configured with.
   */
  readonly envService: FirebaseServerEnvService;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Path on the app URL the user is returned to after a successful connect, e.g. `/app/settings`.
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
   * App paths a sign-in request may ask to return to instead of {@link signInSuccessPath}.
   */
  readonly allowedReturnPaths?: Maybe<readonly string[]>;
}

/**
 * Builds a provider's OAuth configuration from the app's configured origins plus code-declared
 * return paths.
 *
 * The redirect URI is derived rather than configured: it is the app's OAuth origin joined to the
 * same controller path the callback mounts on. Registering a provider therefore requires no
 * deployment configuration of its own.
 *
 * @param config - The env service, the provider, and the return paths.
 * @returns The validated service configuration.
 * @throws {Error} When no app URL is configured, or the derived URIs are inconsistent.
 */
export function userExternalConnectionOAuthServiceConfigFactory(config: UserExternalConnectionOAuthServiceConfigFactoryConfig): UserExternalConnectionOAuthServiceConfig {
  const { envService, providerType, successPath, failurePath, signInSuccessPath, allowedReturnPaths } = config;
  const appUrl = envService.appUrl;

  if (!appUrl) {
    throw new Error(`userExternalConnectionOAuthServiceConfigFactory: "${providerType}" requires an appUrl on the server environment configuration.`);
  }

  const oauthOrigin = envService.appOAuthUrl ?? appUrl;
  const appOrigin = appUrl.replace(/\/+$/, '');

  const result: UserExternalConnectionOAuthServiceConfig = {
    userExternalConnectionOAuth: {
      providerType,
      redirectUri: userExternalConnectionOAuthRedirectUri({ origin: oauthOrigin, providerType }),
      successUrl: `${appOrigin}${successPath}`,
      failureUrl: `${appOrigin}${failurePath ?? successPath}`,
      signInSuccessUrl: `${appOrigin}${signInSuccessPath ?? successPath}`,
      allowedReturnPaths
    }
  };

  UserExternalConnectionOAuthServiceConfig.assertValidConfig(result);
  return result;
}
