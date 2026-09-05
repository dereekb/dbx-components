import { oidcClientSecretBasicAuthorizationHeader, type EmailAddress, type Maybe, type Seconds } from '@dereekb/util';
import { type FetchJsonInput } from '@dereekb/util/fetch';
import { exchangeAuthorizationCode as exchangeOidcAuthorizationCode, refreshAccessToken as refreshOidcAccessToken, revokeToken as revokeOidcToken } from '@dereekb/util/oidc';
import { type DiscordSnowflake } from '../discord.type';
import { DISCORD_OAUTH_CLIENT_AUTH_METHOD, DISCORD_OAUTH_CURRENT_USER_PATH, DISCORD_OAUTH_REVOKE_PATH, DISCORD_OAUTH_TOKEN_PATH, type DiscordOAuthConfig, type DiscordOAuthContext } from './oauth.config';

/**
 * The `Content-Type` Discord's token endpoint requires.
 *
 * Discord rejects a JSON body outright, unlike Cal.com, which requires one.
 *
 * Discord IS an OIDC provider, contrary to what this file previously claimed. Verified directly:
 * `https://discord.com/.well-known/openid-configuration` returns 200 with every required discovery
 * field, `https://discord.com/api/oauth2/keys` serves a JWKS, and the `openid` scope yields an
 * `id_token` on the authorization-code grant. The relying-party calls below therefore delegate to
 * `@dereekb/util/oidc`, passing `clientAuth: 'client_secret_basic'` (Discord's discovery document
 * omits `token_endpoint_auth_methods_supported`, whose OIDC Discovery default is Basic — which is
 * what Discord in fact requires).
 *
 * Discovery itself is not performed: the endpoints are stable, and skipping the extra round trip
 * keeps the per-request cost the same as before.
 */
export const DISCORD_OAUTH_TOKEN_CONTENT_TYPE = 'application/x-www-form-urlencoded';

export interface DiscordOAuthExchangeAuthorizationCodeInput {
  readonly code: string;
  /**
   * Must be byte-identical to the `redirect_uri` sent on the authorize request.
   */
  readonly redirectUri: string;
  /**
   * The PKCE code verifier whose challenge was sent on the authorize request.
   *
   * Optional, and must be omitted when the authorize request carried no `code_challenge` — Discord
   * rejects a `code_verifier` for a code minted without one.
   */
  readonly codeVerifier?: Maybe<string>;
}

export interface DiscordOAuthRevokeTokenInput {
  /**
   * The access or refresh token to revoke.
   */
  readonly token: string;
  /**
   * Optional hint telling Discord which kind of token was passed.
   */
  readonly tokenTypeHint?: Maybe<'access_token' | 'refresh_token'>;
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
  /**
   * The user's email. Present only when the `email` scope was granted.
   *
   * Never key an identity on this — it is mutable, and {@link DiscordOAuthCurrentUser.id} is the
   * stable account identifier.
   */
  readonly email?: Maybe<EmailAddress>;
  /**
   * Whether Discord has verified {@link DiscordOAuthCurrentUser.email}. Present only when the
   * `email` scope was granted.
   *
   * A sign-in must not adopt an existing account by email unless this is true.
   */
  readonly verified?: Maybe<boolean>;
}

/**
 * Builds the HTTP Basic `Authorization` header value that authenticates the OAuth client.
 *
 * Discord requires the client credentials as Basic auth rather than in the request body, which is why
 * `client_id` / `client_secret` are absent from the exchange body below.
 *
 * A thin alias of the generic {@link oidcClientSecretBasicAuthorizationHeader}, kept because the
 * configured fetch bakes the header into its `baseRequest` and so needs it as a value, not as a
 * per-request auth mode.
 *
 * @param config - The client credentials to encode.
 * @returns The `Authorization` header value, including the `Basic ` prefix.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function discordOAuthBasicAuthorizationHeader(config: DiscordOAuthConfig): string {
  return oidcClientSecretBasicAuthorizationHeader(config);
}

/**
 * Exchanges an OAuth authorization code for access and refresh tokens.
 *
 * Delegates to `@dereekb/util/oidc`'s relying-party `exchangeAuthorizationCode` with
 * `clientAuth: 'client_secret_basic'`, which produces exactly the form-encoded, Basic-authenticated
 * request Discord requires. The context's configured fetch supplies the base URL and surfaces
 * Discord's RFC-6749 error bodies as typed {@link DiscordOAuthError}s.
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
  return async (input) => {
    const response = await exchangeOidcAuthorizationCode({
      fetch: context.fetch,
      tokenEndpoint: DISCORD_OAUTH_TOKEN_PATH,
      clientId: context.config.clientId,
      clientSecret: context.config.clientSecret,
      clientAuth: DISCORD_OAUTH_CLIENT_AUTH_METHOD,
      redirectUri: input.redirectUri,
      code: input.code,
      codeVerifier: input.codeVerifier
    });

    return response as DiscordOAuthTokenResponse;
  };
}

/**
 * Refreshes an access token.
 *
 * Discord's refresh response carries a `refresh_token` of its own, so persist whatever comes back
 * rather than assuming the sent one stays valid. That is correct for rotating and non-rotating
 * providers alike.
 *
 * Reached through `DiscordUserExternalConnectionOAuthService.refreshCredentials`, which the external
 * connection reader dispatches to when a user's stored Discord credentials are near expiration.
 *
 * @param context - The Discord OAuth context providing the authenticated fetch.
 * @returns Refreshes an access token using the given refresh token.
 *
 * @see https://docs.discord.com/developers/topics/oauth2
 */
export function refreshAccessToken(context: DiscordOAuthContext): (input: DiscordOAuthRefreshTokenInput) => Promise<DiscordOAuthTokenResponse> {
  return async (input) => {
    const response = await refreshOidcAccessToken({
      fetch: context.fetch,
      tokenEndpoint: DISCORD_OAUTH_TOKEN_PATH,
      clientId: context.config.clientId,
      clientSecret: context.config.clientSecret,
      clientAuth: DISCORD_OAUTH_CLIENT_AUTH_METHOD,
      refreshToken: input.refreshToken
    });

    return response as DiscordOAuthTokenResponse;
  };
}

/**
 * Revokes an access or refresh token, ending Discord's side of the authorization.
 *
 * Called when a user disconnects their Discord account: deleting the stored credentials alone leaves
 * the grant live on Discord, so the token stays usable by anyone who captured it.
 *
 * @param context - The Discord OAuth context providing the authenticated fetch.
 * @returns Revokes the given token.
 *
 * @see https://docs.discord.com/developers/topics/oauth2
 */
export function revokeToken(context: DiscordOAuthContext): (input: DiscordOAuthRevokeTokenInput) => Promise<void> {
  return (input) =>
    revokeOidcToken({
      fetch: context.fetch,
      revocationEndpoint: DISCORD_OAUTH_REVOKE_PATH,
      clientId: context.config.clientId,
      clientSecret: context.config.clientSecret,
      clientAuth: DISCORD_OAUTH_CLIENT_AUTH_METHOD,
      token: input.token,
      tokenTypeHint: input.tokenTypeHint ?? undefined
    });
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
