import { describe, expect, it } from 'vitest';
import { microsoftOAuthAuthorizeUrlFactory } from './oauth.authorize';

const TENANT_ID = 'contoso.onmicrosoft.com';
const REDIRECT_URI = 'http://localhost:9902/oauth/microsoft/callback';

describe('microsoftOAuthAuthorizeUrlFactory()', () => {
  const factory = microsoftOAuthAuthorizeUrlFactory({ tenantId: TENANT_ID, clientId: 'client-id', redirectUri: REDIRECT_URI });

  it('composes the per-tenant authorize URL with the requested scopes plus the OIDC scopes', () => {
    const url = new URL(factory({ state: 'signed-state', codeChallenge: 'challenge', scopes: ['User.Read', 'mail.read'] }));

    expect(`${url.origin}${url.pathname}`).toBe('https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('response_mode')).toBe('query');
    expect(url.searchParams.get('scope')).toBe('User.Read Mail.Read openid profile email offline_access');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('code_challenge')).toBe('challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('omits the challenge when none is given', () => {
    const url = new URL(factory({ scopes: ['User.Read'] }));

    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.has('code_challenge_method')).toBe(false);
    expect(url.searchParams.has('state')).toBe(false);
  });

  it('refuses a multi-tenant authority', () => {
    expect(() => microsoftOAuthAuthorizeUrlFactory({ tenantId: 'common', clientId: 'client-id', redirectUri: REDIRECT_URI })).toThrow('multi-tenant');
  });
});
