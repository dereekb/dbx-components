import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type CalcomOAuthClientId } from '../calcom.config';
import { CALCOM_OAUTH_AUTHORIZE_URL } from './oauth.config';

/**
 * A granular Cal.com OAuth scope.
 *
 * @see https://cal.com/docs/api-reference/v2/oauth
 */
export type CalcomOAuthScope = 'PROFILE_READ' | 'PROFILE_WRITE' | 'BOOKING_READ' | 'BOOKING_WRITE' | 'SCHEDULE_READ' | 'SCHEDULE_WRITE' | 'EVENT_TYPE_READ' | 'EVENT_TYPE_WRITE' | 'APPS_READ' | 'APPS_WRITE' | 'WEBHOOK_READ' | 'WEBHOOK_WRITE';

/**
 * The delimiter used to join scopes in the `scope` query parameter.
 *
 * OAuth2 specifies a space-delimited list. Cal.com's granular scopes are documented without an
 * explicit delimiter, so this is isolated here: if the consent screen rejects the `scope`
 * parameter, this is the only value that needs to change.
 */
export const CALCOM_OAUTH_SCOPE_DELIMITER = ' ';

/**
 * The `response_type` used by the authorization-code flow.
 */
export const CALCOM_OAUTH_AUTHORIZE_RESPONSE_TYPE = 'code';

export interface CalcomOAuthAuthorizeUrlFactoryConfig {
  /**
   * The OAuth client id to authorize as.
   */
  readonly clientId: CalcomOAuthClientId;
  /**
   * The redirect URI to return to after the user consents.
   *
   * Must match the URI registered on the Cal.com OAuth client byte-for-byte, including the port,
   * and must be identical to the `redirectUri` later passed to the token exchange.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The scopes to request.
   */
  readonly scopes: readonly CalcomOAuthScope[];
  /**
   * Optional override of the authorize URL. Defaults to {@link CALCOM_OAUTH_AUTHORIZE_URL}.
   */
  readonly authorizeUrl?: Maybe<WebsiteUrl>;
}

export interface CalcomOAuthAuthorizeUrlParams {
  /**
   * Opaque state echoed back to the redirect URI.
   *
   * Carries the acting user and is the CSRF defense for the handoff, so it should be signed and
   * short-lived.
   */
  readonly state?: Maybe<string>;
}

export type CalcomOAuthAuthorizeUrlFactory = (params?: Maybe<CalcomOAuthAuthorizeUrlParams>) => WebsiteUrl;

/**
 * Creates a {@link CalcomOAuthAuthorizeUrlFactory} that composes the Cal.com authorize URL that a
 * user's browser is redirected to in order to begin the authorization-code flow.
 *
 * The client id, redirect URI, and scopes are fixed by the config, since a consumer holds those
 * constant and varies only the per-request `state`.
 *
 * @param config - The client id, redirect URI, and scopes to request.
 * @returns A factory that builds an authorize URL for the given params.
 *
 * @see https://cal.com/docs/api-reference/v2/oauth
 *
 * @example
 * ```ts
 * const authorizeUrlFactory = calcomOAuthAuthorizeUrlFactory({
 *   clientId: 'client-id',
 *   redirectUri: 'http://localhost:9901/oauth/calcom/callback',
 *   scopes: ['PROFILE_READ', 'BOOKING_READ']
 * });
 *
 * const url = authorizeUrlFactory({ state: 'signed-state' });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calcomOAuthAuthorizeUrlFactory(config: CalcomOAuthAuthorizeUrlFactoryConfig): CalcomOAuthAuthorizeUrlFactory {
  const { clientId, redirectUri, scopes, authorizeUrl: inputAuthorizeUrl } = config;
  const authorizeUrl = inputAuthorizeUrl ?? CALCOM_OAUTH_AUTHORIZE_URL;
  const scope = scopes.join(CALCOM_OAUTH_SCOPE_DELIMITER);

  return (params?: Maybe<CalcomOAuthAuthorizeUrlParams>) => {
    const url = new URL(authorizeUrl);
    const state = params?.state;

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', CALCOM_OAUTH_AUTHORIZE_RESPONSE_TYPE);
    url.searchParams.set('scope', scope);

    if (state != null) {
      url.searchParams.set('state', state);
    }

    return url.toString();
  };
}
