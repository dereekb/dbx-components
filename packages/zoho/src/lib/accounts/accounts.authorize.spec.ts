import { describe, it, expect } from 'vitest';
import { ZOHO_ACCOUNTS_EU_API_URL, ZOHO_ACCOUNTS_US_API_URL } from './accounts.config';
import { ZOHO_ACCOUNTS_AUTHORIZE_PATH, ZOHO_ACCOUNTS_TOKEN_PATH, ZOHO_OAUTH_SCOPE_DELIMITER, zohoAccountsAuthorizeUrlFactory, zohoOAuthScopesFromScopeString, type ZohoOAuthScope } from './accounts.authorize';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/zoho/callback';
const TEST_SCOPES: readonly ZohoOAuthScope[] = ['AaaServer.profile.READ', 'ZohoCRM.modules.READ'];

/**
 * The URL every default-datacenter authorize request must resolve to.
 *
 * Asserted literally rather than composed from the constants, so a change to either the base URL or
 * the endpoint path is a visible, intentional edit to this spec.
 */
const EXPECTED_AUTHORIZE_URL = 'https://accounts.zoho.com/oauth/v2/auth';

const authorizeUrlFactory = zohoAccountsAuthorizeUrlFactory({
  clientId: TEST_CLIENT_ID,
  redirectUri: TEST_REDIRECT_URI,
  scopes: TEST_SCOPES
});

describe('ZOHO_ACCOUNTS_US_API_URL', () => {
  it('should be an accounts base with no endpoint segment of its own', () => {
    // a base carrying its own endpoint segment silently double-appends when composed
    expect(ZOHO_ACCOUNTS_US_API_URL.endsWith(ZOHO_ACCOUNTS_AUTHORIZE_PATH)).toBe(false);
    expect(ZOHO_ACCOUNTS_US_API_URL.endsWith(ZOHO_ACCOUNTS_TOKEN_PATH)).toBe(false);
  });
});

describe('zohoAccountsAuthorizeUrlFactory()', () => {
  it('should target the Zoho authorize endpoint on the default datacenter', () => {
    const url = new URL(authorizeUrlFactory());
    expect(`${url.origin}${url.pathname}`).toBe(EXPECTED_AUTHORIZE_URL);
  });

  it('should include the client id and response type', () => {
    const { searchParams } = new URL(authorizeUrlFactory());

    expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
    expect(searchParams.get('response_type')).toBe('code');
  });

  it('should request offline access with a forced consent prompt', () => {
    // without access_type=offline Zoho issues no refresh token at all, and without prompt=consent it
    // issues one only on the user's FIRST authorization
    const { searchParams } = new URL(authorizeUrlFactory());

    expect(searchParams.get('access_type')).toBe('offline');
    expect(searchParams.get('prompt')).toBe('consent');
  });

  it('should join the scopes on a comma and not on a space', () => {
    const { searchParams } = new URL(zohoAccountsAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: ['a', 'b'] })());

    expect(ZOHO_OAUTH_SCOPE_DELIMITER).toBe(',');
    expect(searchParams.get('scope')).toBe('a,b');
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

  it('should honor a datacenter key', () => {
    const factory = zohoAccountsAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: TEST_SCOPES, accountsApiUrl: 'eu' });
    expect(new URL(factory()).origin).toBe(new URL(ZOHO_ACCOUNTS_EU_API_URL).origin);
  });

  it('should honor a full custom accounts url', () => {
    const factory = zohoAccountsAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: TEST_SCOPES, accountsApiUrl: 'https://accounts.zoho.example' });
    const url = new URL(factory());

    expect(url.origin).toBe('https://accounts.zoho.example');
    expect(url.pathname).toBe(ZOHO_ACCOUNTS_AUTHORIZE_PATH);
  });

  it('should throw at construction when given no client id', () => {
    expect(() => zohoAccountsAuthorizeUrlFactory({ clientId: '', redirectUri: TEST_REDIRECT_URI, scopes: TEST_SCOPES })).toThrow();
  });

  it('should throw at construction when given no scopes', () => {
    // Zoho refuses an authorize request with no scope, so failing here beats failing at the consent screen
    expect(() => zohoAccountsAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: [] })).toThrow();
  });
});

describe('zohoOAuthScopesFromScopeString()', () => {
  it('should split a granted scope string on the comma delimiter', () => {
    expect(zohoOAuthScopesFromScopeString('AaaServer.profile.READ,ZohoCRM.modules.READ')).toEqual(['AaaServer.profile.READ', 'ZohoCRM.modules.READ']);
  });

  it('should return undefined for an empty or absent scope string', () => {
    expect(zohoOAuthScopesFromScopeString('')).toBeUndefined();
    expect(zohoOAuthScopesFromScopeString(null)).toBeUndefined();
    expect(zohoOAuthScopesFromScopeString(undefined)).toBeUndefined();
  });
});
