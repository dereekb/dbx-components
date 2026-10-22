import { describe, expect, it } from 'vitest';
import { ALL_TRELLO_OAUTH_SCOPES, TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE, TRELLO_OAUTH_READ_MEMBER_SCOPE, isTrelloOAuthScope, trelloOAuthAuthorizeUrlFactory } from './oauth.authorize';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/trello/callback';

describe('trelloOAuthAuthorizeUrlFactory()', () => {
  const factory = trelloOAuthAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: [TRELLO_OAUTH_READ_MEMBER_SCOPE, TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE] });

  it('should build the Atlassian authorize url with the code-flow params', () => {
    const url = new URL(factory({ state: 'signed-state' }));

    expect(url.origin).toBe('https://auth.atlassian.com');
    expect(url.pathname).toBe('/authorize');
    expect(url.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('signed-state');
  });

  it('should space-join the scopes', () => {
    const url = new URL(factory({ state: 'signed-state' }));
    expect(url.searchParams.get('scope')).toBe('read:member:trello offline_access');
  });

  it('should send an S256 challenge only when one is given', () => {
    const withChallenge = new URL(factory({ state: 'signed-state', codeChallenge: 'the-challenge' }));
    expect(withChallenge.searchParams.get('code_challenge')).toBe('the-challenge');
    expect(withChallenge.searchParams.get('code_challenge_method')).toBe('S256');

    const withoutChallenge = new URL(factory({ state: 'signed-state' }));
    expect(withoutChallenge.searchParams.has('code_challenge')).toBe(false);
    expect(withoutChallenge.searchParams.has('code_challenge_method')).toBe(false);
  });

  it('should send an audience only when one is configured', () => {
    expect(new URL(factory()).searchParams.has('audience')).toBe(false);

    const withAudience = trelloOAuthAuthorizeUrlFactory({ clientId: TEST_CLIENT_ID, redirectUri: TEST_REDIRECT_URI, scopes: [TRELLO_OAUTH_READ_MEMBER_SCOPE], audience: 'api.atlassian.com' });
    expect(new URL(withAudience()).searchParams.get('audience')).toBe('api.atlassian.com');
  });
});

describe('ALL_TRELLO_OAUTH_SCOPES', () => {
  it('should hold the ten client-configuration scopes plus offline_access', () => {
    expect(ALL_TRELLO_OAUTH_SCOPES).toHaveLength(11);
    expect(ALL_TRELLO_OAUTH_SCOPES).toContain('offline_access');
  });
});

describe('isTrelloOAuthScope()', () => {
  it('should accept a known scope and refuse an unknown one', () => {
    expect(isTrelloOAuthScope('read:board:trello')).toBe(true);
    expect(isTrelloOAuthScope('read')).toBe(false);
  });
});
