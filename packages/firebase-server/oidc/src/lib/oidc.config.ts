import type { Configuration } from 'oidc-provider';
import { type WebsitePath, type SlashPath, type Seconds, SECONDS_IN_DAY, SECONDS_IN_MINUTE } from '@dereekb/util';
import { type OidcScope, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { type JwksServiceConfig } from './service/oidc.jwks.service';
import { type JwksKeyConverterConfig } from './model';

// MARK: Render Error
/**
 * Custom error rendering function for the oidc-provider.
 *
 * Matches the `renderError` option from the oidc-provider `Configuration` type.
 */
export type OidcRenderErrorFunction = Configuration['renderError'];

// MARK: Provider Config
/**
 * OIDC provider-level configuration for scopes, grant types, response types,
 * and claim mappings. These values drive both the oidc-provider instance and the
 * discovery metadata endpoint.
 *
 * Generic on `S` so that claim keys are validated against the app's scope union.
 *
 * @example
 * ```typescript
 * type MyScopes = 'openid' | 'profile' | 'email';
 *
 * const providerConfig: OidcProviderConfig<MyScopes> = {
 *   claims: {
 *     openid: ['sub'],
 *     profile: ['name', 'picture'],
 *     email: ['email', 'email_verified']
 *   },
 *   responseTypes: ['code'],
 *   grantTypes: ['authorization_code', 'refresh_token']
 * };
 * ```
 */
export interface OidcProviderConfig<S extends OidcScope = OidcScope> {
  /**
   * Maps OIDC scope names to the claims they grant access to.
   *
   * The keys also determine `scopes_supported` in the discovery document.
   */
  readonly claims: Record<S, string[]>;
  /**
   * Supported OAuth 2.0 response types (e.g., `['code']`).
   */
  readonly responseTypes: string[];
  /**
   * Supported OAuth 2.0 grant types (e.g., `['authorization_code', 'refresh_token']`).
   */
  readonly grantTypes: string[];
}

// MARK: Token Lifetimes
/**
 * Configures the lifetime (in seconds) for each token type issued by the OIDC provider.
 *
 * `session` and `grant` set the *default* TTLs; the effective values may be reduced when a
 * client passes the `dbx_session_ttl` request param (see {@link OidcModuleConfig.maxRequestedLoginDuration}).
 */
export interface OidcTokenLifetimes {
  /**
   * Access token lifetime in seconds. Defaults to 900 (15 min).
   */
  readonly accessToken: Seconds;
  /**
   * ID token lifetime in seconds. Defaults to 3600 (1 hour).
   */
  readonly idToken: Seconds;
  /**
   * Refresh token lifetime in seconds (absolute). Defaults to 2592000 (30 days).
   */
  readonly refreshToken: Seconds;
  /**
   * Authorization code lifetime in seconds. Defaults to 60.
   */
  readonly authorizationCode: Seconds;
  /**
   * Session lifetime in seconds. Defaults to 2592000 (30 days).
   *
   * Caps how long a user's authenticated session at the IdP lasts before re-authentication is required.
   */
  readonly session: Seconds;
  /**
   * Grant lifetime in seconds. Defaults to 2592000 (30 days).
   *
   * Caps how long a granted authorization (consent) lasts. Once the grant expires, refresh tokens
   * issued under it stop working and the user must re-consent.
   */
  readonly grant: Seconds;
}

/**
 * Default global ceiling for a client-requested login duration, in seconds. 90 days.
 */
export const DEFAULT_MAX_REQUESTED_LOGIN_DURATION_SECONDS = 90 * SECONDS_IN_DAY;

/**
 * Default global floor for a client-requested login duration, in seconds. 1 hour.
 */
export const DEFAULT_MIN_REQUESTED_LOGIN_DURATION_SECONDS = 60 * SECONDS_IN_MINUTE;

/**
 * Default token lifetimes: 15 min access tokens, 30-day refresh tokens, 30-day sessions/grants, 60 s auth codes.
 */
export const DEFAULT_OIDC_TOKEN_LIFETIMES: OidcTokenLifetimes = {
  accessToken: 15 * SECONDS_IN_MINUTE,
  idToken: 60 * SECONDS_IN_MINUTE,
  refreshToken: 30 * SECONDS_IN_DAY,
  authorizationCode: SECONDS_IN_MINUTE,
  session: 30 * SECONDS_IN_DAY,
  grant: 30 * SECONDS_IN_DAY
};

// MARK: Config
/**
 * Configuration for the OIDC module.
 *
 * Used as an abstract class so it can serve as both a type and a NestJS DI token.
 */
export abstract class OidcModuleConfig {
  /**
   * The OIDC issuer URL (e.g., 'https://accounts.example.com').
   * Must be the canonical URL where the OIDC provider is accessible.
   */
  readonly issuer!: string;
  /**
   * The path prefix used for OIDC interaction endpoints (login/consent).
   *
   * Appended to the base appUrl this is the base frontend interaction path.
   *
   * Defaults to '/oauth'.
   */
  readonly appOAuthInteractionPath!: WebsitePath;
  /**
   * Frontend URL for the login interaction page.
   * The interaction uid will be appended as a query parameter.
   *
   * Defaults to `<appOAuthInteractionPath>/login`.
   */
  readonly appOAuthLoginUrlPart!: WebsitePath;
  /**
   * Frontend URL for the consent interaction page.
   *
   * Defaults to `<appOAuthInteractionPath>/consent`.
   */
  readonly appOAuthConsentUrlPart!: WebsitePath;
  /**
   * Token lifetime configuration.
   */
  readonly tokenLifetimes!: OidcTokenLifetimes;
  /**
   * Maximum login duration (seconds) a client may request via the `dbx_session_ttl` auth-URL param.
   *
   * Acts as the global server cap for any per-request duration. A registered client can declare its own
   * lower ceiling via the `dbx_max_session_ttl` client metadata field; the effective ceiling is
   * `min(client.dbx_max_session_ttl, this)`.
   *
   * Defaults to {@link DEFAULT_MAX_REQUESTED_LOGIN_DURATION_SECONDS} (90 days).
   */
  readonly maxRequestedLoginDuration?: number;
  /**
   * Minimum login duration (seconds) a client may request via the `dbx_session_ttl` auth-URL param.
   *
   * Requested values below this floor are clamped up. Prevents pathological 30-second sessions.
   *
   * Defaults to {@link DEFAULT_MIN_REQUESTED_LOGIN_DURATION_SECONDS} (1 hour).
   */
  readonly minRequestedLoginDuration?: number;
  /**
   * Default login duration (seconds) used when a client does NOT pass the `dbx_session_ttl`
   * auth-URL param. When undefined, falls back to {@link OidcTokenLifetimes.refreshToken}.
   */
  readonly defaultRequestedLoginDuration?: number;
  /**
   * JWKS service configuration (encryption secret, rotated key max age).
   */
  readonly jwksServiceConfig!: JwksServiceConfig;
  /**
   * JWKS key converter configuration (encryption secret for Firestore field encryption).
   */
  readonly jwksKeyConverterConfig!: JwksKeyConverterConfig;
  /**
   * Custom error rendering function for the oidc-provider.
   *
   * When not provided, defaults to a JSON error response with `error` and `error_description` fields.
   * Set this to customize how OIDC errors are presented (e.g. redirect to an error page).
   *
   * The function signature matches oidc-provider's `renderError` configuration option.
   */
  readonly renderError?: OidcRenderErrorFunction;
  /**
   * Whether to suppress the oidc-provider "already parsed request body" warning.
   *
   * Enable this when running behind a platform (e.g. Firebase Cloud Functions) that
   * parses request bodies before they reach the OIDC provider. The provider handles
   * this correctly by falling back to `req.body`, but emits a one-time warning.
   *
   * Defaults to `false`.
   */
  readonly suppressBodyParserWarning?: boolean;
  /**
   * Path prefixes that require OAuth bearer token verification.
   *
   * Only requests matching one of these prefixes will be checked by the
   * {@link OidcAuthBearerTokenMiddleware}. When non-empty, the middleware
   * module is automatically registered by {@link oidcModuleMetadata}.
   *
   * Paths under the global API route prefix should not be included
   * since those are typically protected by AppCheck.
   */
  readonly protectedPaths?: SlashPath[];

  /**
   * Supported token endpoint authentication methods.
   *
   * Overrides the default methods (`client_secret_post`, `client_secret_basic`)
   * in the discovery metadata document.
   *
   * @see DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS
   */
  readonly tokenEndpointAuthMethods?: OidcTokenEndpointAuthMethod[];

  /**
   * Whether to enable the OIDC dynamic client registration endpoint (`/reg`).
   *
   * When enabled, clients can self-register via the registration endpoint
   * and manage their registrations via the registration management feature.
   *
   * Defaults to `false`.
   */
  readonly registrationEnabled?: boolean;

  /**
   * Whether the oidc-provider should trust upstream proxy headers
   * (`X-Forwarded-Host`, `X-Forwarded-Proto`) when computing the request URL
   * used to build resume/return URLs and discovery metadata absolute paths.
   *
   * Required when running behind a reverse proxy such as Firebase Hosting →
   * Cloud Run / Cloud Functions, where the request `Host` header is the
   * underlying Cloud Run host (e.g. `api-xxxxx-uc.a.run.app`) and not the
   * canonical issuer host. Without this, the interaction `returnTo` URL is
   * built off the Cloud Run host and the browser is redirected away from the
   * issuer's domain after login — causing the interaction cookies (scoped to
   * the canonical host) to be missing on the resume request and producing
   * "authorization request has expired".
   *
   * Maps to `provider.proxy = <value>` on the underlying oidc-provider
   * (which is the Koa `app.proxy` setting).
   *
   * Defaults to `'prod_only'` if the environment is `production`, otherwise `false`.
   */
  readonly trustProxy?: boolean;

  /**
   * Whether to trust proxy headers in a non-production environment, such as the local environment.
   *
   * The dev environment typically does not require proxy headers, and setting
   * `true` will result in errors.
   *
   * Defaults to `false`.
   */
  readonly trustProxyInNonProduction?: boolean;

  /**
   * Validates that all required fields are present on the config.
   *
   * Called by {@link oidcModuleConfigFactory} after building the config from environment variables.
   *
   * @param config - the config object to validate
   * @throws {Error} When any required field (`issuer`, `appInteractionPath`, `appLoginUrlPart`, `appConsentUrlPart`, `jwksServiceConfig`, `jwksKeyConverterConfig`) is missing.
   */
  static assertValidConfig(config: Partial<OidcModuleConfig>) {
    if (!config.issuer) {
      throw new Error('OidcModuleConfig: issuer is required.');
    }

    if (!config.appOAuthInteractionPath) {
      throw new Error('OidcModuleConfig: appInteractionPath is required.');
    }

    if (!config.appOAuthLoginUrlPart) {
      throw new Error('OidcModuleConfig: appLoginUrlPart is required.');
    }

    if (!config.appOAuthConsentUrlPart) {
      throw new Error('OidcModuleConfig: appConsentUrlPart is required.');
    }

    if (!config.jwksServiceConfig) {
      throw new Error('OidcModuleConfig: jwksServiceConfig is required.');
    }

    if (!config.jwksKeyConverterConfig) {
      throw new Error('OidcModuleConfig: jwksKeyConverterConfig is required.');
    }
  }
}
