import { JwksServiceConfig } from './service/jwks.service';
import { JwksKeyConverterConfig } from './model';

// MARK: Scope
/**
 * Base type for OIDC scope string unions.
 *
 * Applications define their own scope union extending this type to get
 * compile-time validation of scope names throughout the delegate and config.
 *
 * @example
 * ```typescript
 * type MyScopes = 'openid' | 'profile' | 'email';
 * ```
 */
export type OidcScope = string;

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
export interface OidcTokenLifetimes {
  /**
   * Access token lifetime in seconds. Defaults to 900 (15 min).
   */
  readonly accessToken: number;
  /**
   * Refresh token lifetime in seconds (absolute). Defaults to 2592000 (30 days).
   */
  readonly refreshToken: number;
  /**
   * Authorization code lifetime in seconds. Defaults to 60.
   */
  readonly authorizationCode: number;
}

export const DEFAULT_OIDC_TOKEN_LIFETIMES: OidcTokenLifetimes = {
  accessToken: 900,
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
