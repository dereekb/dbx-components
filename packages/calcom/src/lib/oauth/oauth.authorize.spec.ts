import { describe, it, expect } from 'vitest';
import { CALCOM_OAUTH_AUTHORIZE_URL } from './oauth.config';
import { CALCOM_OAUTH_SCOPE_DELIMITER, calcomOAuthAuthorizeUrlFactory, type CalcomOAuthScope } from './oauth.authorize';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/calcom/callback';
const TEST_SCOPES: readonly CalcomOAuthScope[] = ['PROFILE_READ', 'BOOKING_READ', 'BOOKING_WRITE'];

const authorizeUrlFactory = calcomOAuthAuthorizeUrlFactory({
  clientId: TEST_CLIENT_ID,
  redirectUri: TEST_REDIRECT_URI,
  scopes: TEST_SCOPES
});

describe('calcomOAuthAuthorizeUrlFactory()', () => {
  it('should target the Cal.com authorize URL', () => {
    const url = new URL(authorizeUrlFactory());
    const expected = new URL(CALCOM_OAUTH_AUTHORIZE_URL);

    expect(url.origin).toBe(expected.origin);
    expect(url.pathname).toBe(expected.pathname);
  });

  it('should include the client id, response type, and joined scopes', () => {
    const { searchParams } = new URL(authorizeUrlFactory());

    expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
    expect(searchParams.get('response_type')).toBe('code');
    expect(searchParams.get('scope')).toBe(TEST_SCOPES.join(CALCOM_OAUTH_SCOPE_DELIMITER));
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
    const authorizeUrl = 'https://app.cal.dev/auth/oauth2/authorize';
    const factory = calcomOAuthAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: TEST_SCOPES, authorizeUrl });

    expect(new URL(factory()).origin).toBe('https://app.cal.dev');
  });
});
