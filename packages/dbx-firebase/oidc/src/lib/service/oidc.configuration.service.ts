import { Injectable, inject, type Type } from '@angular/core';
import { type SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type OidcScopeDetails, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { type AbstractDbxFirebaseOAuthConsentScopeViewComponent } from '../interaction/components/oauth.consent.scope.view.component';

export const DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH = '/oidc/auth';
export const DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH = '/interaction';
export const DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY = 'uid';
export const DEFAULT_OIDC_CLIENT_ID_PARAM_KEY = 'client_id';
export const DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY = 'client_name';
export const DEFAULT_OIDC_CLIENT_URI_PARAM_KEY = 'client_uri';
export const DEFAULT_OIDC_LOGO_URI_PARAM_KEY = 'logo_uri';
export const DEFAULT_OIDC_SCOPES_PARAM_KEY = 'scopes';
export const DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ['client_secret_post', 'client_secret_basic'];

/**
 * Abstract configuration class used as a DI token for app-level OIDC settings.
 *
 * Apps provide a concrete implementation via `provideDbxFirebaseOidc()`.
 */
export abstract class DbxFirebaseOidcConfig {
  /**
   * Available scopes for the OIDC provider. Used in scope picker fields.
   */
  abstract readonly availableScopes: OidcScopeDetails[];
  /**
   * Path to the authorization endpoint. Defaults to '/oidc/auth'.
   */
  readonly oidcAuthorizationEndpointApiPath?: Maybe<string>;
  /**
   * Base path for interaction endpoints. Defaults to '/interaction'.
   */
  readonly oidcInteractionEndpointApiPath?: Maybe<string>;
  /**
   * Supported token endpoint authentication methods.
   *
   * Overrides the default methods (`client_secret_post`, `client_secret_basic`).
   * Used by forms and UI components that need to know which auth methods are available.
   */
  readonly tokenEndpointAuthMethods?: Maybe<OidcTokenEndpointAuthMethod[]>;
  /**
   * Frontend route ref for the OAuth interaction pages (login/consent).
   *
   * When provided, this route is registered with {@link DbxAppAuthRouterService} as an
   * ignored route, preventing auth effects from redirecting away during the OIDC flow.
   *
   * Uses hierarchical matching — a parent route ref (e.g., `'app.oauth'`) will cover
   * all child routes (e.g., `'app.oauth.login'`, `'app.oauth.consent'`).
   */
  readonly oauthInteractionRoute?: Maybe<SegueRefOrSegueRefRouterLink>;
  /**
   * Component class for rendering the consent scope list.
   *
   * When not provided, uses `DbxFirebaseOAuthConsentScopeDefaultViewComponent` which
   * maps scope names to descriptions from `availableScopes`.
   */
  readonly consentScopeListViewClass?: Maybe<Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>>;
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

  get availableScopes(): OidcScopeDetails[] {
    return this.config.availableScopes;
  }

  get oidcAuthorizationEndpointApiPath(): string {
    return this.config.oidcAuthorizationEndpointApiPath ?? DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH;
  }

  get oidcInteractionEndpointApiPath(): string {
    return this.config.oidcInteractionEndpointApiPath ?? DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH;
  }

  get tokenEndpointAuthMethods(): OidcTokenEndpointAuthMethod[] {
    return this.config.tokenEndpointAuthMethods ?? DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS;
  }

  get oauthInteractionRoute(): Maybe<SegueRefOrSegueRefRouterLink> {
    return this.config.oauthInteractionRoute;
  }

  get consentScopeListViewClass(): Maybe<Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>> {
    return this.config.consentScopeListViewClass;
  }
}
