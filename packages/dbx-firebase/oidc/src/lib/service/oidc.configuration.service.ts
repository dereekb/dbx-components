import { DOCUMENT, Injectable, inject, type Type } from '@angular/core';
import { type SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import { type DbxMcpConnectOAuthClient } from '@dereekb/dbx-web';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { KNOWN_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTIONS, type OidcProviderProfileDetails, type OidcRedirectUriSuggestion, type OidcScopeDetails, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { type AbstractDbxFirebaseOAuthConsentScopeViewComponent } from '../interaction/components/oauth.consent.scope.view.component';

export const DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH = '/oidc/auth';
export const DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH = '/interaction';
export const DEFAULT_OIDC_INTERACTION_UID_PARAM_KEY = 'uid';
export const DEFAULT_OIDC_CLIENT_ID_PARAM_KEY = 'client_id';
export const DEFAULT_OIDC_CLIENT_NAME_PARAM_KEY = 'client_name';
export const DEFAULT_OIDC_CLIENT_URI_PARAM_KEY = 'client_uri';
export const DEFAULT_OIDC_LOGO_URI_PARAM_KEY = 'logo_uri';
export const DEFAULT_OIDC_SCOPES_PARAM_KEY = 'scopes';
export const DEFAULT_OIDC_REQUIRED_SCOPES_PARAM_KEY = 'requiredScopes';
/**
 * Default path of the app's MCP server, appended to the API origin.
 *
 * Mirrors `DEFAULT_MCP_PATH` in `@dereekb/firebase-server/mcp`.
 */
export const DEFAULT_OIDC_MCP_PATH = '/mcp';
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
   * Available provider profiles for admin assignment on the client form. When set, the client form
   * renders a provider-profile multi-select. Leave unset when the app defines no provider profiles.
   */
  readonly availableProviderProfiles?: Maybe<OidcProviderProfileDetails[]>;
  /**
   * Optional API origin (scheme + host, e.g. `https://api.example.com`) prepended to the OIDC
   * authorization and interaction endpoint paths when set.
   *
   * Use this when the OIDC provider is hosted on a different origin than the frontend so that
   * the authorization redirect and interaction POSTs target the issuer host directly (e.g. to
   * avoid an intermediate hosting layer that strips cookies). Should not include a trailing
   * slash and should not include the `/api` path segment — OIDC endpoints live at the root.
   *
   * Leave unset for single-origin deployments; the endpoint paths stay relative.
   */
  readonly oidcApiOrigin?: Maybe<string>;
  /**
   * Url of the app's MCP server, shown to users by `dbx-mcp-connect-button` and `dbx-mcp-connect-view` in `@dereekb/dbx-web`.
   *
   * Defaults to {@link oidcApiOrigin} (or the page's origin when unset) followed by {@link DEFAULT_OIDC_MCP_PATH}. Set it when the server is
   * served from somewhere else, such as a local emulator. It must match the server's `appMcpUrl` byte-for-byte, since MCP clients use it as
   * the OAuth resource.
   */
  readonly mcpUrl?: Maybe<WebsiteUrl>;
  /**
   * Pre-registered OAuth client that `dbx-mcp-connect-button` and `dbx-mcp-connect-view` tell users to sign in to the MCP server with.
   *
   * Set it when the server does not offer dynamic client registration and the app has one client for every user. It ships with the app, so
   * leave out the client secret unless it is fine for every user to see it. Views given their own client, such as one a user registered, use
   * that one instead.
   */
  readonly mcpOAuthClient?: Maybe<DbxMcpConnectOAuthClient>;
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
   * Whether the client form suggests the redirect URIs of well-known MCP clients (Claude, ChatGPT, Grok, Cursor, and Grok Bot).
   *
   * When true, {@link KNOWN_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTIONS} are shown as suggestion chips on the redirect URIs field, ahead of
   * any {@link redirectUriSuggestions}. False by default.
   */
  readonly showMcpClientRedirectUriSuggestions?: Maybe<boolean>;
  /**
   * Additional redirect URI suggestions shown as suggestion chips on the client form's redirect URIs field.
   */
  readonly redirectUriSuggestions?: Maybe<OidcRedirectUriSuggestion[]>;
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
  private readonly document = inject(DOCUMENT);

  get availableScopes(): OidcScopeDetails[] {
    return this.config.availableScopes;
  }

  get availableProviderProfiles(): Maybe<OidcProviderProfileDetails[]> {
    return this.config.availableProviderProfiles;
  }

  get oidcAuthorizationEndpointApiPath(): string {
    const origin = this.config.oidcApiOrigin ?? '';
    return `${origin}${this.config.oidcAuthorizationEndpointApiPath ?? DEFAULT_OIDC_AUTHORIZATION_ENDPOINT_PATH}`;
  }

  get oidcInteractionEndpointApiPath(): string {
    const origin = this.config.oidcApiOrigin ?? '';
    return `${origin}${this.config.oidcInteractionEndpointApiPath ?? DEFAULT_OIDC_INTERACTION_ENDPOINT_PATH}`;
  }

  /**
   * Url of the app's MCP server.
   *
   * @returns The configured {@link DbxFirebaseOidcConfig.mcpUrl}, or the API origin (or the page's origin) followed by {@link DEFAULT_OIDC_MCP_PATH}.
   */
  get mcpUrl(): WebsiteUrl {
    return this.config.mcpUrl ?? `${this.config.oidcApiOrigin ?? this.document.location.origin}${DEFAULT_OIDC_MCP_PATH}`;
  }

  /**
   * Pre-registered OAuth client for the app's MCP server.
   *
   * @returns The configured {@link DbxFirebaseOidcConfig.mcpOAuthClient}, if any.
   */
  get mcpOAuthClient(): Maybe<DbxMcpConnectOAuthClient> {
    return this.config.mcpOAuthClient;
  }

  get tokenEndpointAuthMethods(): OidcTokenEndpointAuthMethod[] {
    return this.config.tokenEndpointAuthMethods ?? DEFAULT_OIDC_TOKEN_ENDPOINT_AUTH_METHODS;
  }

  /**
   * Redirect URI suggestions for the client form, combining the known MCP client suggestions (when enabled) with the app's own suggestions.
   *
   * @returns The redirect URI suggestions to show, in display order.
   */
  get redirectUriSuggestions(): OidcRedirectUriSuggestion[] {
    const mcpClientSuggestions = this.config.showMcpClientRedirectUriSuggestions ? KNOWN_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTIONS : [];
    return [...mcpClientSuggestions, ...(this.config.redirectUriSuggestions ?? [])];
  }

  get oauthInteractionRoute(): Maybe<SegueRefOrSegueRefRouterLink> {
    return this.config.oauthInteractionRoute;
  }

  get consentScopeListViewClass(): Maybe<Type<AbstractDbxFirebaseOAuthConsentScopeViewComponent>> {
    return this.config.consentScopeListViewClass;
  }
}
