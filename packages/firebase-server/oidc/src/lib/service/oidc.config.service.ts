import { Inject, Injectable } from '@nestjs/common';
import { OidcModuleConfig, type OidcProviderConfig } from '../oidc.config';
import { OidcAccountService } from './account.service';
import type { Configuration } from 'oidc-provider';
import { mergeSlashPaths, WebsitePath, WebsiteUrl, websiteUrlFromPaths } from '@dereekb/util';
import { type OidcScope, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';

// MARK: Routes
/**
 * Default oidc-provider route paths.
 *
 * These match the oidc-provider defaults and are used to build
 * both the provider configuration and the discovery document.
 *
 * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md
 */
export const DEFAULT_OIDC_ROUTES = {
  authorization: '/auth',
  token: '/token',
  userinfo: '/me',
  jwks: '/jwks',
  registration: '/reg',
  end_session: '/session/end',
  code_verification: '/device',
  device_authorization: '/device/auth',
  introspection: '/token/introspection',
  revocation: '/token/revocation',
  pushed_authorization_request: '/request'
} as const;

export type OidcRoutes = typeof DEFAULT_OIDC_ROUTES;

// MARK: Discovery Defaults
export const DEFAULT_OIDC_SUBJECT_TYPES: readonly string[] = ['public'];
export const DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: readonly OidcTokenEndpointAuthMethod[] = ['client_secret_post', 'client_secret_basic'];
export const DEFAULT_OIDC_ID_TOKEN_SIGNING_ALG_VALUES: readonly string[] = ['RS256'];
export const DEFAULT_OIDC_CODE_CHALLENGE_METHODS: readonly string[] = ['S256'];

// MARK: Discovery Metadata
/**
 * OpenID Connect Discovery metadata (RFC 8414 / OpenID Connect Discovery 1.0).
 */
export interface OidcDiscoveryMetadata {
  readonly issuer: WebsiteUrl;
  readonly authorization_endpoint: WebsiteUrl;
  readonly token_endpoint: WebsiteUrl;
  readonly userinfo_endpoint: WebsiteUrl;
  readonly jwks_uri: WebsiteUrl;
  readonly registration_endpoint?: WebsiteUrl;
  readonly scopes_supported: OidcScope[];
  readonly response_types_supported: string[];
  readonly response_modes_supported: string[];
  readonly grant_types_supported: string[];
  readonly subject_types_supported: string[];
  readonly id_token_signing_alg_values_supported: string[];
  readonly token_endpoint_auth_methods_supported: OidcTokenEndpointAuthMethod[];
  readonly claims_supported: string[];
  readonly code_challenge_methods_supported: string[];
}

// MARK: Service
/**
 * Centralizes all derived OIDC provider configuration so that both the
 * oidc-provider instance and the discovery endpoint use the same values.
 *
 * Reads provider-level settings (scopes, claims, grant types, response types) from
 * the {@link OidcAccountServiceDelegate.providerConfig} via the injected account service.
 *
 * Injected into {@link OidcService} and {@link OidcWellKnownController}.
 */
@Injectable()
export class OidcProviderConfigService {
  readonly routes: OidcRoutes = DEFAULT_OIDC_ROUTES;

  /**
   * If the OIDC registration route is enabled.
   */
  readonly oidcRegistrationRouteEnabled: boolean;

  /**
   * The url to the front-end login page.
   */
  readonly appLoginUrl: WebsiteUrl;

  /**
   * The url to the front-end consent page.
   */
  readonly appConsentUrl: WebsiteUrl;

  /**
   * The app-provided provider config from the delegate.
   */
  readonly providerConfig: OidcProviderConfig;

  /**
   * Scopes derived from the claims configuration keys.
   */
  readonly scopesSupported: string[];

  /**
   * Flat list of all unique claim names from the claims configuration.
   */
  readonly claimsSupported: string[];

  /**
   * Token endpoint authentication methods from config or defaults.
   */
  readonly tokenEndpointAuthMethodsSupported: OidcTokenEndpointAuthMethod[];

  constructor(
    @Inject(OidcModuleConfig) private readonly config: OidcModuleConfig,
    @Inject(OidcAccountService) accountService: OidcAccountService,
    @Inject(FirebaseServerEnvService) envService: FirebaseServerEnvService
  ) {
    this.providerConfig = accountService.providerConfig;
    this.scopesSupported = Object.keys(this.providerConfig.claims);
    this.claimsSupported = [...new Set(Object.values(this.providerConfig.claims).flat())];
    this.tokenEndpointAuthMethodsSupported = this.config.tokenEndpointAuthMethods ?? [...DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS];

    const appUrl = envService.appUrl as string;

    this.appLoginUrl = websiteUrlFromPaths(appUrl, [this.config.appOAuthInteractionPath, this.config.appOAuthLoginUrlPart]);
    this.appConsentUrl = websiteUrlFromPaths(appUrl, [this.config.appOAuthInteractionPath, this.config.appOAuthConsentUrlPart]);
    this.oidcRegistrationRouteEnabled = config.registrationEnabled === true;
  }

  /**
   * Builds the oidc-provider {@link Configuration} options that are spread into
   * `new Provider(issuer, { ...options })`.
   *
   * Does NOT include `adapter`, `findAccount`, or `jwks` — those require async
   * setup and are handled by {@link OidcService}.
   */
  buildProviderConfiguration(cookieKeys: string[]): Configuration {
    const config = this.config;
    const providerConfig = this.providerConfig;

    return {
      routes: { ...this.routes },
      claims: { ...providerConfig.claims },
      responseTypes: [...providerConfig.responseTypes] as Configuration['responseTypes'],
      pkce: {
        required: () => true
      },
      features: {
        devInteractions: { enabled: false },
        registration: { enabled: this.oidcRegistrationRouteEnabled },
        registrationManagement: { enabled: this.oidcRegistrationRouteEnabled }
      },
      ttl: {
        AccessToken: config.tokenLifetimes.accessToken,
        IdToken: config.tokenLifetimes.idToken,
        AuthorizationCode: config.tokenLifetimes.authorizationCode,
        RefreshToken: config.tokenLifetimes.refreshToken,
        Session: 14 * 24 * 60 * 60,
        Grant: 14 * 24 * 60 * 60,
        Interaction: 60 * 60,
        DeviceCode: 10 * 60
      },
      interactions: {
        url: (_ctx: unknown, interaction: { prompt: { name: string }; uid: string }) => {
          if (interaction.prompt.name === 'login') {
            return `${this.appLoginUrl}?uid=${interaction.uid}`;
          }
          return `${this.appConsentUrl}?uid=${interaction.uid}`;
        }
      },
      cookies: {
        keys: cookieKeys
      },
      ...(config.renderError ? { renderError: config.renderError } : {})
    };
  }

  /**
   * Builds the OpenID Connect Discovery metadata document.
   *
   * @param jwksUri - Optional override for the JWKS URI (e.g., from cloud storage).
   *   Falls back to `{issuer}{routes.jwks}`.
   */
  buildDiscoveryMetadata(jwksUri?: string): OidcDiscoveryMetadata {
    const issuer = this.config.issuer;
    const providerConfig = this.providerConfig;
    const routes = this.routes;

    return {
      issuer,
      authorization_endpoint: `${issuer}${routes.authorization}`,
      token_endpoint: `${issuer}${routes.token}`,
      userinfo_endpoint: `${issuer}${routes.userinfo}`,
      jwks_uri: jwksUri ?? `${issuer}${routes.jwks}`,
      registration_endpoint: this.oidcRegistrationRouteEnabled ? `${issuer}${routes.registration}` : undefined,
      scopes_supported: this.scopesSupported,
      response_types_supported: [...providerConfig.responseTypes],
      response_modes_supported: ['query'],
      grant_types_supported: [...providerConfig.grantTypes],
      subject_types_supported: [...DEFAULT_OIDC_SUBJECT_TYPES],
      id_token_signing_alg_values_supported: [...DEFAULT_OIDC_ID_TOKEN_SIGNING_ALG_VALUES],
      token_endpoint_auth_methods_supported: [...this.tokenEndpointAuthMethodsSupported],
      claims_supported: this.claimsSupported,
      code_challenge_methods_supported: [...DEFAULT_OIDC_CODE_CHALLENGE_METHODS]
    };
  }
}
