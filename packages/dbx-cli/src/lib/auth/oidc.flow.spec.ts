import { describe, it, expect } from 'vitest';
import { OAUTH_OOB_REDIRECT_URI } from '@dereekb/util';
import { buildAuthorizationUrl, generatePkceMaterial, parsePastedRedirect } from './oidc.flow';

describe('generatePkceMaterial', () => {
  it('generates a verifier and challenge', async () => {
    const m = await generatePkceMaterial();
    expect(m.codeVerifier.length).toBeGreaterThan(40);
    expect(m.codeChallenge.length).toBeGreaterThan(40);
    expect(m.codeVerifier).not.toBe(m.codeChallenge);
  });
});

describe('buildAuthorizationUrl', () => {
  it('encodes the standard authorization params', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      scopes: 'openid demo',
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/oidc/auth');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('redirect_uri')).toBe(OAUTH_OOB_REDIRECT_URI);
    expect(parsed.searchParams.get('scope')).toBe('openid demo');
    expect(parsed.searchParams.get('state')).toBe('xyz');
    expect(parsed.searchParams.get('code_challenge')).toBe('chal');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('rebases the authorization endpoint origin onto appClientUrl when set', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'http://localhost:9902/dereekb-components/us-central1/api/oidc/auth',
      appClientUrl: 'http://localhost:9010',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('http://localhost:9010');
    expect(parsed.pathname).toBe('/dereekb-components/us-central1/api/oidc/auth');
  });

  it('leaves the authorization endpoint untouched when neither appClientUrl, oidcIssuer, nor apiBaseUrl is set', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/oidc/auth');
  });

  it('targets <oidcIssuer>/login/client when appClientUrl is missing and oidcIssuer is set', () => {
    // Models the cross-origin OIDC split: regular API lives at `${origin}/api/*` (NestJS global
    // prefix) but OIDC routes are excluded and mounted at `${origin}/oidc/*`. apiBaseUrl would
    // produce the wrong URL here (`${origin}/api/oidc/login/client`); oidcIssuer is correct.
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://api.example.com/oidc/auth',
      oidcIssuer: 'https://api.example.com/oidc',
      apiBaseUrl: 'https://api.example.com/api',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.example.com/oidc/login/client');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('state')).toBe('xyz');
  });

  it('strips trailing slashes from oidcIssuer when building the login/client URL', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://api.example.com/oidc/auth',
      oidcIssuer: 'https://api.example.com/oidc/',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.example.com/oidc/login/client');
  });

  it('prefers oidcIssuer over apiBaseUrl when both are set (no appClientUrl)', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://api.example.com/oidc/auth',
      oidcIssuer: 'https://api.example.com/oidc',
      apiBaseUrl: 'https://api.example.com/api',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.example.com/oidc/login/client');
  });

  it('targets <apiBaseUrl>/oidc/login/client when appClientUrl is missing and apiBaseUrl is set', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'http://localhost:9902/dereekb-components/us-central1/api/oidc/auth',
      apiBaseUrl: 'http://localhost:9902/dereekb-components/us-central1/api',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://localhost:9902/dereekb-components/us-central1/api/oidc/login/client');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('state')).toBe('xyz');
  });

  it('strips trailing slashes from apiBaseUrl when building the login/client URL', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      apiBaseUrl: 'https://example.com/api/',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/api/oidc/login/client');
  });

  it('preserves an existing query string on the authorization endpoint', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth?foo=bar',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      scopes: 'openid demo',
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/oidc/auth');
    expect(parsed.searchParams.get('foo')).toBe('bar');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('redirect_uri')).toBe(OAUTH_OOB_REDIRECT_URI);
    expect(parsed.searchParams.get('scope')).toBe('openid demo');
    expect(parsed.searchParams.get('state')).toBe('xyz');
    expect(parsed.searchParams.get('code_challenge')).toBe('chal');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('prefers appClientUrl over oidcIssuer and apiBaseUrl when all three are set', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'http://localhost:9902/dereekb-components/us-central1/api/oidc/auth',
      oidcIssuer: 'http://localhost:9902/dereekb-components/us-central1/api/oidc',
      apiBaseUrl: 'http://localhost:9902/dereekb-components/us-central1/api',
      appClientUrl: 'http://localhost:9010',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('http://localhost:9010');
    expect(parsed.pathname).toBe('/dereekb-components/us-central1/api/oidc/auth');
  });

  it('omits dbx_session_ttl when requestedSessionTtlSeconds is not provided', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('dbx_session_ttl')).toBe(false);
  });

  it('includes dbx_session_ttl as integer seconds when requestedSessionTtlSeconds is set', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal',
      requestedSessionTtlSeconds: 60 * 60 * 24 * 30
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('dbx_session_ttl')).toBe(String(60 * 60 * 24 * 30));
  });

  it('throws when requestedSessionTtlSeconds is not a positive integer', () => {
    expect(() =>
      buildAuthorizationUrl({
        authorizationEndpoint: 'https://example.com/oidc/auth',
        clientId: 'cid',
        redirectUri: OAUTH_OOB_REDIRECT_URI,
        state: 'xyz',
        codeChallenge: 'chal',
        requestedSessionTtlSeconds: -1
      })
    ).toThrow();

    expect(() =>
      buildAuthorizationUrl({
        authorizationEndpoint: 'https://example.com/oidc/auth',
        clientId: 'cid',
        redirectUri: OAUTH_OOB_REDIRECT_URI,
        state: 'xyz',
        codeChallenge: 'chal',
        requestedSessionTtlSeconds: 12.5
      })
    ).toThrow();
  });
});

describe('parsePastedRedirect', () => {
  it('extracts code from a redirect URL', () => {
    const result = parsePastedRedirect({ pasted: 'https://example.com/callback?code=abc123&state=xyz' });
    expect(result).toEqual({ code: 'abc123', state: 'xyz' });
  });

  it('returns code when given a bare code string', () => {
    expect(parsePastedRedirect({ pasted: 'plain-code' })).toEqual({ code: 'plain-code' });
  });

  it('throws on state mismatch', () => {
    expect(() => parsePastedRedirect({ pasted: 'https://example.com/callback?code=a&state=wrong', expectedState: 'right' })).toThrow();
  });

  it('throws when the URL has an error param', () => {
    expect(() => parsePastedRedirect({ pasted: 'https://example.com/callback?error=access_denied' })).toThrow();
  });

  it('throws when input is empty', () => {
    expect(() => parsePastedRedirect({ pasted: '   ' })).toThrow();
  });
});
