import { describe, expect, it } from 'vitest';
import { ALL_DISCORD_OAUTH_SCOPES, DISCORD_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD, DISCORD_OAUTH_SCOPE_DELIMITER, discordOAuthAuthorizeUrlFactory, isDiscordOAuthScope, type DiscordOAuthScope } from './oauth.authorize';
import { DISCORD_OAUTH_AUTHORIZE_URL } from './oauth.config';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/discord/callback';
const TEST_SCOPES: readonly DiscordOAuthScope[] = ['identify', 'email'];

const authorizeUrlFactory = discordOAuthAuthorizeUrlFactory({
  clientId: TEST_CLIENT_ID,
  redirectUri: TEST_REDIRECT_URI,
  scopes: TEST_SCOPES
});

describe('DISCORD_OAUTH_AUTHORIZE_URL', () => {
  it('should be served from the site root, not the api base', () => {
    // Discord serves the consent screen from discord.com/oauth2/authorize while the token endpoint
    // lives under /api/v10 — a single base URL cannot cover both
    const url = new URL(DISCORD_OAUTH_AUTHORIZE_URL);

    expect(url.origin).toBe('https://discord.com');
    expect(url.pathname).toBe('/oauth2/authorize');
  });
});

describe('ALL_DISCORD_OAUTH_SCOPES', () => {
  it('should model only the scopes an account connect or sign-in can ask for', () => {
    expect([...ALL_DISCORD_OAUTH_SCOPES]).toEqual(['openid', 'identify', 'email', 'guilds', 'connections']);
  });

  it('should recognize every modeled scope', () => {
    expect(ALL_DISCORD_OAUTH_SCOPES.every(isDiscordOAuthScope)).toBe(true);
  });

  it('should reject a scope it does not model', () => {
    // a bad scope should fail here rather than at the consent screen
    expect(isDiscordOAuthScope('role_connections.write')).toBe(false);
  });
});

describe('discordOAuthAuthorizeUrlFactory()', () => {
  it('should target the Discord authorize URL', () => {
    const url = new URL(authorizeUrlFactory());
    const expected = new URL(DISCORD_OAUTH_AUTHORIZE_URL);

    expect(url.origin).toBe(expected.origin);
    expect(url.pathname).toBe(expected.pathname);
  });

  it('should include the client id, response type, and space-joined scopes', () => {
    const { searchParams } = new URL(authorizeUrlFactory());

    expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
    expect(searchParams.get('response_type')).toBe('code');
    expect(searchParams.get('scope')).toBe('identify email');
    expect(searchParams.get('scope')).toBe(TEST_SCOPES.join(DISCORD_OAUTH_SCOPE_DELIMITER));
  });

  it('should percent-encode the scope delimiter in the composed url', () => {
    // OAuth2's space delimiter has to survive the query string; URL.searchParams handles it
    expect(authorizeUrlFactory()).toContain('scope=identify+email');
  });

  it('should preserve the redirect uri exactly', () => {
    // the redirect_uri must be byte-identical to the registered value and to the token exchange
    const { searchParams } = new URL(authorizeUrlFactory());
    expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
  });

  it('should pass the state through when provided', () => {
    const state = 'signed-state-value';
    const { searchParams } = new URL(authorizeUrlFactory({ state }));
    expect(searchParams.get('state')).toBe(state);
  });

  it('should omit the state parameter when not provided', () => {
    const { searchParams } = new URL(authorizeUrlFactory());
    expect(searchParams.has('state')).toBe(false);
  });

  it('should not mutate shared state across calls', () => {
    const first = authorizeUrlFactory({ state: 'first' });
    const second = authorizeUrlFactory();

    expect(new URL(first).searchParams.get('state')).toBe('first');
    expect(new URL(second).searchParams.has('state')).toBe(false);
  });

  it('should use a provided authorize url override', () => {
    const authorizeUrl = 'https://canary.discord.com/oauth2/authorize';
    const factory = discordOAuthAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: TEST_SCOPES, authorizeUrl });

    expect(new URL(factory()).origin).toBe('https://canary.discord.com');
  });
});

describe('discordOAuthAuthorizeUrlFactory() PKCE', () => {
  it('should emit the code challenge with the S256 method when one is given', () => {
    const url = new URL(authorizeUrlFactory({ state: 'signed-state', codeChallenge: 'a-challenge' }));

    expect(url.searchParams.get('code_challenge')).toBe('a-challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe(DISCORD_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD);
  });

  it('should never offer the plain challenge method', () => {
    // `plain` gives no protection against an attacker who can read the authorization request
    expect(DISCORD_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD).toBe('S256');
  });

  it('should omit both PKCE params when no challenge is given', () => {
    // a state minted before PKCE was added carries no verifier; sending a challenge the exchange
    // cannot answer would break that in-flight flow
    const url = new URL(authorizeUrlFactory({ state: 'signed-state' }));

    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.has('code_challenge_method')).toBe(false);
  });
});
