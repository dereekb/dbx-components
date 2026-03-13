import type { Configuration } from 'oidc-provider';
import { type SlashPath } from '@dereekb/util';
import { type OidcScope } from '@dereekb/firebase';
import { JwksServiceConfig } from './service/jwks.service';
import { JwksKeyConverterConfig } from './model';

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
 */
export interface OidcTokenLifetimes {
  /**
   * Access token lifetime in seconds. Defaults to 900 (15 min).
   */
  readonly accessToken: number;
  /**
   * ID token lifetime in seconds. Defaults to 3600 (1 hour).
   */
  readonly idToken: number;
  /**
   * Refresh token lifetime in seconds (absolute). Defaults to 2592000 (30 days).
   */
  readonly refreshToken: number;
  /**
   * Authorization code lifetime in seconds. Defaults to 60.
   */
  readonly authorizationCode: number;
}

/**
 * Default token lifetimes: 15 min access tokens, 30-day refresh tokens, 60 s auth codes.
 */
export const DEFAULT_OIDC_TOKEN_LIFETIMES: OidcTokenLifetimes = {
  accessToken: 900,
  idToken: 3600,
  refreshToken: 30 * 24 * 60 * 60,
  authorizationCode: 60
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
   * Frontend URL for the login interaction page.
   * The interaction uid will be appended as a query parameter.
   */
  readonly loginUrl!: string;
  /**
   * Frontend URL for the consent interaction page.
   */
  readonly consentUrl!: string;
  /**
   * The path prefix used for OIDC interaction endpoints (login/consent).
   *
   * Appended to the appUrl to form the `loginUrl` and `consentUrl`.
   * Defaults to '/oidc/interaction'.
   */
  readonly interactionPath!: string;
  /**
   * Token lifetime configuration.
   */
  readonly tokenLifetimes!: OidcTokenLifetimes;
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
   * Validates that all required fields are present on the config.
   *
   * Called by {@link oidcModuleConfigFactory} after building the config from environment variables.
   *
   * @throws {Error} When any required field (`issuer`, `loginUrl`, `consentUrl`, `jwksServiceConfig`, `jwksKeyConverterConfig`) is missing.
   */
  static assertValidConfig(config: OidcModuleConfig) {
    if (!config.issuer) {
      throw new Error('OidcModuleConfig: issuer is required.');
    }

    if (!config.loginUrl) {
      throw new Error('OidcModuleConfig: loginUrl is required.');
    }

    if (!config.consentUrl) {
      throw new Error('OidcModuleConfig: consentUrl is required.');
    }

    if (!config.jwksServiceConfig) {
      throw new Error('OidcModuleConfig: jwksServiceConfig is required.');
    }

    if (!config.jwksKeyConverterConfig) {
      throw new Error('OidcModuleConfig: jwksKeyConverterConfig is required.');
    }
  }
}
