import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type DiscordOAuthClientId } from '../discord.config';
import { DISCORD_OAUTH_AUTHORIZE_URL } from './oauth.config';

/**
 * The Discord OAuth scopes this package models.
 *
 * A runtime list rather than a bare type union, so a configured scope can be validated instead of
 * being passed through to the consent screen and refused there.
 *
 * Deliberately NOT Discord's full ~40-scope surface: only what a per-user account connect or sign-in
 * can legitimately ask for. Add a scope here when code actually uses it.
 *
 * `openid` is included because Discord is an OIDC provider (its discovery document and JWKS are
 * live) and requesting it yields an `id_token`. Nothing in this workspace consumes that token —
 * identity is read server-side from `/users/@me` — but the scope is legal to request.
 *
 * @see https://docs.discord.com/developers/topics/oauth2
 */
export const ALL_DISCORD_OAUTH_SCOPES = ['openid', 'identify', 'email', 'guilds', 'connections'] as const;

/**
 * A Discord OAuth scope modeled by this package.
 */
export type DiscordOAuthScope = (typeof ALL_DISCORD_OAUTH_SCOPES)[number];

/**
 * Returns whether the input is a known {@link DiscordOAuthScope}.
 *
 * @param value - The value to check.
 * @returns True when the value is a Discord OAuth scope this package models.
 */
export function isDiscordOAuthScope(value: string): value is DiscordOAuthScope {
  return (ALL_DISCORD_OAUTH_SCOPES as readonly string[]).includes(value);
}

/**
 * The delimiter used to join scopes in the `scope` query parameter.
 *
 * OAuth2 specifies a space-delimited list and Discord follows it. `URL.searchParams.set` handles the
 * percent-encoding, so this stays a literal space.
 */
export const DISCORD_OAUTH_SCOPE_DELIMITER = ' ';

/**
 * The `response_type` used by the authorization-code flow.
 */
export const DISCORD_OAUTH_AUTHORIZE_RESPONSE_TYPE = 'code';

/**
 * The only PKCE challenge method this package emits.
 *
 * `plain` is not offered: it provides no protection against an attacker who can read the
 * authorization request, which is the threat PKCE exists to address.
 */
export const DISCORD_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD = 'S256';

export interface DiscordOAuthAuthorizeUrlFactoryConfig {
  /**
   * The OAuth client id to authorize as.
   */
  readonly clientId: DiscordOAuthClientId;
  /**
   * The redirect URI to return to after the user consents.
   *
   * Must match a URI registered on the Discord application byte-for-byte, including the port, and
   * must be identical to the `redirectUri` later passed to the token exchange.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The scopes to request.
   */
  readonly scopes: readonly DiscordOAuthScope[];
  /**
   * Optional override of the authorize URL. Defaults to {@link DISCORD_OAUTH_AUTHORIZE_URL}.
   */
  readonly authorizeUrl?: Maybe<WebsiteUrl>;
}

export interface DiscordOAuthAuthorizeUrlParams {
  /**
   * Opaque state echoed back to the redirect URI.
   *
   * Carries the acting user and is the CSRF defense for the handoff, so it should be signed and
   * short-lived.
   */
  readonly state?: Maybe<string>;
  /**
   * The PKCE code challenge — the base64url SHA-256 digest of a code verifier the caller retains.
   *
   * Discord supports PKCE S256. Optional because a state minted before PKCE was added carries no
   * verifier, and sending a challenge the later exchange cannot answer would break that flow; every
   * new authorization should set it.
   */
  readonly codeChallenge?: Maybe<string>;
}

export type DiscordOAuthAuthorizeUrlFactory = (params?: Maybe<DiscordOAuthAuthorizeUrlParams>) => WebsiteUrl;

/**
 * Creates a {@link DiscordOAuthAuthorizeUrlFactory} that composes the Discord authorize URL a user's
 * browser is redirected to in order to begin the authorization-code flow.
 *
 * The client id, redirect URI, and scopes are fixed by the config, since a consumer holds those
 * constant and varies only the per-request `state`.
 *
 * @param config - The client id, redirect URI, and scopes to request.
 * @returns A factory that builds an authorize URL for the given params.
 *
 * @see https://docs.discord.com/developers/topics/oauth2
 *
 * @example
 * ```ts
 * const authorizeUrlFactory = discordOAuthAuthorizeUrlFactory({
 *   clientId: 'client-id',
 *   redirectUri: 'http://localhost:9901/oauth/discord/callback',
 *   scopes: ['identify']
 * });
 *
 * const url = authorizeUrlFactory({ state: 'signed-state', codeChallenge: 's256-challenge' });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function discordOAuthAuthorizeUrlFactory(config: DiscordOAuthAuthorizeUrlFactoryConfig): DiscordOAuthAuthorizeUrlFactory {
  const { clientId, redirectUri, scopes, authorizeUrl: inputAuthorizeUrl } = config;
  const authorizeUrl = inputAuthorizeUrl ?? DISCORD_OAUTH_AUTHORIZE_URL;
  const scope = scopes.join(DISCORD_OAUTH_SCOPE_DELIMITER);

  return (params?: Maybe<DiscordOAuthAuthorizeUrlParams>) => {
    const url = new URL(authorizeUrl);
    const state = params?.state;

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', DISCORD_OAUTH_AUTHORIZE_RESPONSE_TYPE);
    url.searchParams.set('scope', scope);

    if (state != null) {
      url.searchParams.set('state', state);
    }

    if (params?.codeChallenge != null) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', DISCORD_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD);
    }

    return url.toString();
  };
}
