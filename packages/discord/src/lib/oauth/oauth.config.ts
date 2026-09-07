import { type FactoryWithRequiredInput, type OidcClientAuthMethod } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type DiscordOAuthClientId, type DiscordOAuthClientSecret } from '../discord.config';

/**
 * The Discord OAuth2 authorize URL the user's browser is redirected to.
 *
 * Note this is NOT under `/api`: Discord serves the consent screen from the site root, while the
 * token endpoint lives under {@link DISCORD_API_URL}. It is therefore a full URL rather than a path
 * relative to the API base.
 */
export const DISCORD_OAUTH_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';

/**
 * The Discord OAuth2 token endpoint path, relative to {@link DISCORD_API_URL}.
 */
export const DISCORD_OAUTH_TOKEN_PATH = '/oauth2/token';

/**
 * The Discord OAuth2 token revocation endpoint path, relative to {@link DISCORD_API_URL}.
 */
export const DISCORD_OAUTH_REVOKE_PATH = '/oauth2/token/revoke';

/**
 * How this client authenticates itself at Discord's token and revocation endpoints.
 *
 * Discord's discovery document omits `token_endpoint_auth_methods_supported`, whose OIDC Discovery
 * default is `client_secret_basic` — and Discord does in fact require Basic, rejecting the
 * credentials-in-body form the OAuth relying-party layer otherwise defaults to.
 */
export const DISCORD_OAUTH_CLIENT_AUTH_METHOD: OidcClientAuthMethod = 'client_secret_basic';

/**
 * Discord's OIDC issuer.
 *
 * `https://discord.com/.well-known/openid-configuration` resolves against it, though this package
 * does not perform discovery — the endpoint paths above are stable, so the extra round trip buys
 * nothing. Exported for consumers that do want to discover.
 */
export const DISCORD_OIDC_ISSUER = 'https://discord.com';

/**
 * Path of the endpoint returning the user an access token belongs to.
 *
 * Requires the `identify` scope.
 */
export const DISCORD_OAUTH_CURRENT_USER_PATH = '/users/@me';

/**
 * Configuration for a Discord OAuth client.
 *
 * Both values are required: unlike Cal.com, Discord has no api-key alternative to the
 * client-credentials pair, so there is no valid partially-configured state.
 */
export interface DiscordOAuthConfig {
  readonly clientId: DiscordOAuthClientId;
  readonly clientSecret: DiscordOAuthClientSecret;
}

export interface DiscordOAuthFetchFactoryInput {
  /**
   * The client credentials the produced fetch authenticates the token endpoint with.
   *
   * Passed in rather than closed over, because the Basic authorization header is part of the fetch's
   * baseRequest and so cannot be composed before the credentials are known.
   */
  readonly config: DiscordOAuthConfig;
}

export type DiscordOAuthFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, DiscordOAuthFetchFactoryInput>;

/**
 * Context used for performing fetch() and fetchJson() calls with a configured fetch instance.
 */
export interface DiscordOAuthContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly config: DiscordOAuthConfig;
}

export interface DiscordOAuthContextRef {
  readonly oauthContext: DiscordOAuthContext;
}
