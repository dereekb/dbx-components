import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type ZohoOAuthClientId } from '../zoho.config';
import { type ZohoAccountsConfigApiUrlInput, zohoAccountsConfigApiUrl } from './accounts.config';

/**
 * Path of the Zoho Accounts authorization (consent screen) endpoint.
 */
export const ZOHO_ACCOUNTS_AUTHORIZE_PATH = '/oauth/v2/auth';

/**
 * Path of the Zoho Accounts token endpoint.
 */
export const ZOHO_ACCOUNTS_TOKEN_PATH = '/oauth/v2/token';

/**
 * The delimiter Zoho joins and returns granted scopes with.
 *
 * A comma, NOT the space OAuth 2.0 specifies. Both halves of the round trip use this: the authorize
 * request joins on it, and the granted `scope` string comes back split on it.
 */
export const ZOHO_OAUTH_SCOPE_DELIMITER = ',';

/**
 * The `response_type` used by the authorization-code flow.
 */
export const ZOHO_OAUTH_AUTHORIZE_RESPONSE_TYPE = 'code';

/**
 * Required for Zoho to return a `refresh_token` at all.
 */
export const ZOHO_OAUTH_OFFLINE_ACCESS_TYPE = 'offline';

/**
 * Forces the consent screen.
 *
 * Without it Zoho returns a refresh token only on a user's FIRST authorization, so a reconnect would
 * come back with an access token alone — and a persisted exchange that omits the refresh token
 * silently breaks the connection.
 */
export const ZOHO_OAUTH_CONSENT_PROMPT = 'consent';

/**
 * A Zoho OAuth scope, e.g. `ZohoCRM.modules.READ` or `AaaServer.profile.READ`.
 *
 * Deliberately an open string alias and NOT a closed union: Zoho's scope namespace is per-product,
 * dotted, and open-ended, so a runtime list would be stale on arrival. Cal.com can enumerate its
 * twelve; Zoho cannot.
 */
export type ZohoOAuthScope = string;

export interface ZohoAccountsAuthorizeUrlFactoryConfig {
  /**
   * The OAuth client id to authorize as.
   */
  readonly clientId: ZohoOAuthClientId;
  /**
   * The redirect URI to return to after the user consents.
   *
   * Must match the URI registered on the Zoho OAuth client byte-for-byte, including the port, and
   * must be identical to the `redirectUri` later passed to the token exchange.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The scopes to request.
   */
  readonly scopes: readonly ZohoOAuthScope[];
  /**
   * Accounts host to authorize against. Defaults to the `us` datacenter.
   */
  readonly accountsApiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
  /**
   * Defaults to {@link ZOHO_OAUTH_OFFLINE_ACCESS_TYPE}, without which no refresh token is issued.
   */
  readonly accessType?: Maybe<string>;
  /**
   * Defaults to {@link ZOHO_OAUTH_CONSENT_PROMPT}, without which a RE-consent issues no refresh token.
   */
  readonly prompt?: Maybe<string>;
}

export interface ZohoAccountsAuthorizeUrlParams {
  /**
   * Opaque state echoed back to the redirect URI.
   *
   * Carries the acting user and is the CSRF defense for the handoff, so it should be signed and
   * short-lived.
   */
  readonly state?: Maybe<string>;
}

export type ZohoAccountsAuthorizeUrlFactory = (params?: Maybe<ZohoAccountsAuthorizeUrlParams>) => WebsiteUrl;

/**
 * Creates a {@link ZohoAccountsAuthorizeUrlFactory} that composes the Zoho authorize URL a user's
 * browser is redirected to in order to begin the authorization-code flow.
 *
 * The client id, redirect URI, and scopes are fixed by the config, since a consumer holds those
 * constant and varies only the per-request `state`.
 *
 * @param config - The client id, redirect URI, scopes, and optional datacenter/consent overrides.
 * @returns A factory that builds an authorize URL for the given params.
 * @throws {Error} When no client id is given, or when no scopes are requested — Zoho refuses an
 *   authorize request carrying no scope, and failing at construction beats failing at the consent
 *   screen.
 *
 * @see https://www.zoho.com/accounts/protocol/oauth/web-apps/authorization.html
 *
 * @example
 * ```typescript
 * const authorizeUrlFactory = zohoAccountsAuthorizeUrlFactory({
 *   clientId: 'client-id',
 *   redirectUri: 'http://localhost:9901/oauth/zoho/callback',
 *   scopes: ['AaaServer.profile.READ']
 * });
 *
 * const url = authorizeUrlFactory({ state: 'signed-state' });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoAccountsAuthorizeUrlFactory(config: ZohoAccountsAuthorizeUrlFactoryConfig): ZohoAccountsAuthorizeUrlFactory {
  const { clientId, redirectUri, scopes, accountsApiUrl, accessType, prompt } = config;

  if (!clientId) {
    throw new Error('zohoAccountsAuthorizeUrlFactory() requires a clientId.');
  }

  if (!scopes.length) {
    throw new Error('zohoAccountsAuthorizeUrlFactory() requires at least one scope. Zoho refuses an authorize request that carries no scope.');
  }

  const apiUrl = zohoAccountsConfigApiUrl(accountsApiUrl ?? 'us');
  const scope = scopes.join(ZOHO_OAUTH_SCOPE_DELIMITER);
  const authorizeAccessType = accessType ?? ZOHO_OAUTH_OFFLINE_ACCESS_TYPE;
  const authorizePrompt = prompt ?? ZOHO_OAUTH_CONSENT_PROMPT;

  return (params?: Maybe<ZohoAccountsAuthorizeUrlParams>) => {
    const url = new URL(ZOHO_ACCOUNTS_AUTHORIZE_PATH, apiUrl);
    const state = params?.state;

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', ZOHO_OAUTH_AUTHORIZE_RESPONSE_TYPE);
    url.searchParams.set('scope', scope);
    url.searchParams.set('access_type', authorizeAccessType);
    url.searchParams.set('prompt', authorizePrompt);

    if (state != null) {
      url.searchParams.set('state', state);
    }

    return url.toString();
  };
}

/**
 * Splits a granted Zoho `scope` string on the same delimiter the authorize request joins with.
 *
 * @param scope - The granted scope string returned on a token response.
 * @returns The granted scopes, or undefined when none were granted.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoOAuthScopesFromScopeString(scope: Maybe<string>): Maybe<ZohoOAuthScope[]> {
  const scopes = scope ? scope.split(ZOHO_OAUTH_SCOPE_DELIMITER).filter((x) => x.length > 0) : undefined;
  return scopes?.length ? scopes : undefined;
}
