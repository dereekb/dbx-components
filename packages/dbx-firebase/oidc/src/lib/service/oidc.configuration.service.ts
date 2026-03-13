import { Injectable, inject } from '@angular/core';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import { type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';

export const DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH = '/oidc/auth';
export const DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH = '/interaction';
export const DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY = 'uid';
export const DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY = 'client_name';
export const DEFAULT_OIDC_SCOPES_PARAM_KEY = 'scopes';
export const DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ['client_secret_post', 'client_secret_basic'];

/**
 * Abstract configuration class used as a DI token for app-level OIDC settings.
 *
 * Apps provide a concrete implementation via `provideDbxFirebaseOidc()`.
 */
export abstract class DbxFirebaseOidcConfig {
  /** Available scopes for the OIDC provider. Used in scope picker fields. */
  abstract readonly availableScopes: LabeledValue<string>[];
  /** Path to the authorization endpoint. Defaults to '/oidc/auth'. */
  readonly oidcAuthorizationEndpointApiPath?: Maybe<string>;
  /** Base path for interaction endpoints. Defaults to '/interaction'. */
  readonly oidcInteractionEndpointApiPath?: Maybe<string>;
  /** Route param key for the interaction UID. Defaults to 'uid'. */
  readonly oidcInteractionUidParamKey?: Maybe<string>;
  /** Route param key for the client name (consent only). Defaults to 'client_name'. */
  readonly clientNameParamKey?: Maybe<string>;
  /** Route param key for the scopes (consent only). Defaults to 'scopes'. */
  readonly scopesParamKey?: Maybe<string>;
  /**
   * Supported token endpoint authentication methods.
   *
   * Overrides the default methods (`client_secret_post`, `client_secret_basic`).
   * Used by forms and UI components that need to know which auth methods are available.
   */
  readonly tokenEndpointAuthMethods?: Maybe<OidcTokenEndpointAuthMethod[]>;
}

/**
 * Service that exposes the app-level OIDC configuration.
 *
 * Inject this service in components to access centralized OIDC settings
 * (scopes, endpoint paths, param keys, etc.) without requiring explicit inputs.
 */
@Injectable()
export class DbxFirebaseOidcConfigService {
  private readonly config = inject(DbxFirebaseOidcConfig);

  get availableScopes(): LabeledValue<string>[] {
    return this.config.availableScopes;
  }

  get oidcAuthorizationEndpointApiPath(): string {
    return this.config.oidcAuthorizationEndpointApiPath ?? DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH;
  }

  get oidcInteractionEndpointApiPath(): string {
    return this.config.oidcInteractionEndpointApiPath ?? DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH;
  }

  get oidcInteractionUidParamKey(): string {
    return this.config.oidcInteractionUidParamKey ?? DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY;
  }

  get clientNameParamKey(): string {
    return this.config.clientNameParamKey ?? DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY;
  }

  get scopesParamKey(): string {
    return this.config.scopesParamKey ?? DEFAULT_OIDC_SCOPES_PARAM_KEY;
  }

  get tokenEndpointAuthMethods(): OidcTokenEndpointAuthMethod[] {
    return this.config.tokenEndpointAuthMethods ?? DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS;
  }
}
