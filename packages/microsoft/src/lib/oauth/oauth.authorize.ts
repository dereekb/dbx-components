import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type MicrosoftEntraTenantId, type MicrosoftOAuthClientId } from '../microsoft.config';
import { assertMicrosoftSingleTenantId, MICROSOFT_OAUTH_AUTHORIZE_PATH, microsoftOAuthTenantBaseUrl } from './oauth.config';
import { MICROSOFT_OIDC_SCOPES, type MicrosoftGraphScope, normalizeMicrosoftGraphScopes } from './oauth.scope';

/**
 * The delimiter used to join scopes in the `scope` query parameter.
 */
export const MICROSOFT_OAUTH_SCOPE_DELIMITER = ' ';

/**
 * The `response_type` used by the authorization-code flow.
 */
export const MICROSOFT_OAUTH_AUTHORIZE_RESPONSE_TYPE = 'code';

/**
 * The `response_mode` the code is returned with: as query parameters on the redirect URI.
 */
export const MICROSOFT_OAUTH_AUTHORIZE_RESPONSE_MODE = 'query';

/**
 * The only PKCE challenge method this package emits.
 */
export const MICROSOFT_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD = 'S256';

export interface MicrosoftOAuthAuthorizeUrlFactoryConfig {
  /**
   * The single tenant to authorize against. Multi-tenant authorities are refused.
   */
  readonly tenantId: MicrosoftEntraTenantId;
  /**
   * The OAuth client id to authorize as.
   */
  readonly clientId: MicrosoftOAuthClientId;
  /**
   * The redirect URI to return to after the user consents. Must match a redirect URI on the app
   * registration and the `redirectUri` later passed to the token exchange.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * Optional override of the authorize URL. Defaults to the tenant's `/oauth2/v2.0/authorize`.
   */
  readonly authorizeUrl?: Maybe<WebsiteUrl>;
}

export interface MicrosoftOAuthAuthorizeUrlParams {
  /**
   * Opaque state echoed back to the redirect URI.
   */
  readonly state?: Maybe<string>;
  /**
   * The PKCE S256 code challenge.
   */
  readonly codeChallenge?: Maybe<string>;
  /**
   * The Graph scopes to request. Passed per call because the requested set depends on the scope preset
   * the user picked. The OIDC scopes are always added.
   */
  readonly scopes: readonly MicrosoftGraphScope[];
}

export type MicrosoftOAuthAuthorizeUrlFactory = (params: MicrosoftOAuthAuthorizeUrlParams) => WebsiteUrl;

/**
 * Creates a {@link MicrosoftOAuthAuthorizeUrlFactory} that composes the per-tenant Microsoft identity
 * platform authorize URL a user's browser is redirected to.
 *
 * Always requests the {@link MICROSOFT_OIDC_SCOPES} (so the response carries an `id_token` and a refresh
 * token), uses `response_mode=query`, and sends the PKCE challenge with `S256` when given.
 *
 * @param config - The tenant, client id and redirect URI.
 * @returns A factory building an authorize URL for the given state, challenge and scopes.
 * @throws {Error} When the tenant is a multi-tenant authority.
 *
 * @example
 * ```ts
 * const factory = microsoftOAuthAuthorizeUrlFactory({ tenantId: 'contoso.onmicrosoft.com', clientId: 'client-id', redirectUri: 'http://localhost:9902/oauth/microsoft/callback' });
 * const url = factory({ state: 'signed-state', codeChallenge: 's256-challenge', scopes: ['User.Read', 'Mail.Read'] });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function microsoftOAuthAuthorizeUrlFactory(config: MicrosoftOAuthAuthorizeUrlFactoryConfig): MicrosoftOAuthAuthorizeUrlFactory {
  const { clientId, redirectUri } = config;
  const tenantId = assertMicrosoftSingleTenantId(config.tenantId);
  const authorizeUrl = config.authorizeUrl ?? `${microsoftOAuthTenantBaseUrl(tenantId)}${MICROSOFT_OAUTH_AUTHORIZE_PATH}`;

  return (params: MicrosoftOAuthAuthorizeUrlParams) => {
    const url = new URL(authorizeUrl);
    const scope = normalizeMicrosoftGraphScopes([...params.scopes, ...MICROSOFT_OIDC_SCOPES]).join(MICROSOFT_OAUTH_SCOPE_DELIMITER);

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', MICROSOFT_OAUTH_AUTHORIZE_RESPONSE_TYPE);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', MICROSOFT_OAUTH_AUTHORIZE_RESPONSE_MODE);
    url.searchParams.set('scope', scope);

    if (params.state != null) {
      url.searchParams.set('state', params.state);
    }

    if (params.codeChallenge != null) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', MICROSOFT_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD);
    }

    return url.toString();
  };
}
