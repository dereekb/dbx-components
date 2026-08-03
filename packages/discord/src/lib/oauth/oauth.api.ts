import { type Maybe, type Seconds } from '@dereekb/util';
import { type FetchJsonInput } from '@dereekb/util/fetch';
import { type DiscordSnowflake } from '../discord.config';
import { DISCORD_OAUTH_CURRENT_USER_PATH, DISCORD_OAUTH_TOKEN_PATH, type DiscordOAuthConfig, type DiscordOAuthContext } from './oauth.config';

/**
 * The `Content-Type` Discord's token endpoint requires.
 *
 * Discord rejects a JSON body outright, unlike Cal.com, which requires one.
 *
 * `@dereekb/util/oidc`'s `postTokenEndpoint` is the in-workspace precedent for this form-encoded
 * shape and is deliberately NOT reused: its `exchangeAuthorizationCode` requires a PKCE
 * `code_verifier`, it authenticates with `client_secret_post` rather than Basic, and it is
 * discovery-driven. Discord is not an OIDC provider — there is no discovery document and no
 * `id_token`.
 */
export const DISCORD_OAUTH_TOKEN_CONTENT_TYPE = 'application/x-www-form-urlencoded';

export interface DiscordOAuthExchangeAuthorizationCodeInput {
  readonly code: string;
  /**
   * Must be byte-identical to the `redirect_uri` sent on the authorize request.
   */
  readonly redirectUri: string;
}

export interface DiscordOAuthRefreshTokenInput {
  readonly refreshToken: string;
}

export interface DiscordOAuthReadCurrentUserInput {
  /**
   * The user's access token. NOT the client credentials.
   */
  readonly accessToken: string;
}

export interface DiscordOAuthTokenResponse {
  readonly access_token: string;
  readonly token_type: 'Bearer';
  /**
   * Seconds until expiry.
   *
   * Discord issues 604800 (7 days), far longer than most providers. Nothing structural depends on
   * that, but it does mean an expiry bug surfaces a week after it is introduced rather than an hour.
   */
  readonly expires_in: Seconds;
  readonly refresh_token: string;
  /**
   * The granted scopes, space-delimited.
   */
  readonly scope?: Maybe<string>;
}

/**
 * The subset of Discord's user object this package reads.
 *
 * @see https://docs.discord.com/developers/resources/user
 */
export interface DiscordOAuthCurrentUser {
  readonly id: DiscordSnowflake;
  readonly username: string;
  /**
   * The user's chosen display name, which supersedes the legacy `username#discriminator` pair.
   *
   * Null for accounts that have not migrated.
   */
  readonly global_name?: Maybe<string>;
  readonly discriminator?: Maybe<string>;
  readonly avatar?: Maybe<string>;
}

/**
 * Builds the HTTP Basic `Authorization` header value that authenticates the OAuth client.
 *
 * Discord accepts the client credentials as Basic auth rather than in the request body, which is why
 * `client_id` / `client_secret` are absent from the exchange body below.
 *
 * Uses `btoa()` rather than `Buffer`, so this package stays usable outside Node — the same choice
 * `@dereekb/util`'s PKCE helpers make.
 *
 * @param config - The client credentials to encode.
 * @returns The `Authorization` header value, including the `Basic ` prefix.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function discordOAuthBasicAuthorizationHeader(config: DiscordOAuthConfig): string {
  const credentials = `${config.clientId}:${config.clientSecret}`;
  return `Basic ${btoa(credentials)}`;
}

/**
 * Exchanges an OAuth authorization code for access and refresh tokens.
 *
 * Discord requires `application/x-www-form-urlencoded` — a JSON body is rejected — and authenticates
 * the client with HTTP Basic rather than credentials in the body. Both differ from Cal.com, which
 * posts JSON with the credentials inline. The Basic header rides on the context's configured fetch.
 *
 * @param context - The Discord OAuth context providing the authenticated fetch.
 * @returns Exchanges an authorization code for access and refresh tokens.
 *
 * @see https://docs.discord.com/developers/topics/oauth2
 *
 * @example
 * ```ts
 * const response = await exchangeAuthorizationCode(context)({
 *   code: 'auth-code-from-redirect',
 *   redirectUri: 'http://localhost:9901/oauth/discord/callback'
 * });
 * ```
 */
export function exchangeAuthorizationCode(context: DiscordOAuthContext): (input: DiscordOAuthExchangeAuthorizationCodeInput) => Promise<DiscordOAuthTokenResponse> {
  return (input) => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri
    });

    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: body.toString()
    };

    return context.fetchJson(DISCORD_OAUTH_TOKEN_PATH, fetchJsonInput);
  };
}

/**
 * Refreshes an access token.
 *
 * Discord's refresh response carries a `refresh_token` of its own, so persist whatever comes back
 * rather than assuming the sent one stays valid. That is correct for rotating and non-rotating
 * providers alike.
 *
 * NOTE: nothing calls this yet — the external-connection framework has no refresh path for any
 * provider. It ships because it is the other half of the token endpoint.
 *
 * @param context - The Discord OAuth context providing the authenticated fetch.
 * @returns Refreshes an access token using the given refresh token.
 *
 * @see https://docs.discord.com/developers/topics/oauth2
 */
export function refreshAccessToken(context: DiscordOAuthContext): (input: DiscordOAuthRefreshTokenInput) => Promise<DiscordOAuthTokenResponse> {
  return (input) => {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken
    });

    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: body.toString()
    };

    return context.fetchJson(DISCORD_OAUTH_TOKEN_PATH, fetchJsonInput);
  };
}

/**
 * Reads the user an access token belongs to. Requires the `identify` scope.
 *
 * Bearer-authenticated with the USER's token, not Basic-authenticated with the client credentials, so
 * the `Authorization` header is passed per-request to override the one on the context's fetch. A
 * per-request header wins over the base header of the same name, which is what makes one configured
 * fetch enough for both shapes.
 *
 * @param context - The Discord OAuth context providing the authenticated fetch.
 * @returns Reads the Discord user the given access token belongs to.
 *
 * @see https://docs.discord.com/developers/resources/user
 */
export function readCurrentUser(context: DiscordOAuthContext): (input: DiscordOAuthReadCurrentUserInput) => Promise<DiscordOAuthCurrentUser> {
  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.accessToken}`
      }
    };

    return context.fetchJson(DISCORD_OAUTH_CURRENT_USER_PATH, fetchJsonInput);
  };
}
