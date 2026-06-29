import { describe, it, expect } from 'vitest';
import { OAUTH_OOB_REDIRECT_URI, buildAuthorizationUrl, buildOidcDiscoveryCandidates, generateOAuthState, generatePkceMaterial, parseAuthorizationRedirect } from './oauth';

describe('generatePkceMaterial()', () => {
  it('generates a verifier and a distinct challenge', async () => {
    const material = await generatePkceMaterial();
    expect(material.codeVerifier.length).toBeGreaterThan(40);
    expect(material.codeChallenge.length).toBeGreaterThan(40);
    expect(material.codeVerifier).not.toBe(material.codeChallenge);
  });
});

describe('generateOAuthState()', () => {
  it('returns a 32-character hex string', () => {
    const state = generateOAuthState();
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns a unique value on each call', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateOAuthState()));
    expect(states.size).toBe(50);
  });
});

describe('buildOidcDiscoveryCandidates()', () => {
  it('builds the issuer-prefixed and origin-rooted candidates in order', () => {
    const candidates = buildOidcDiscoveryCandidates({ issuer: 'https://api.example.com/oidc' });
    expect(candidates).toEqual(['https://api.example.com/oidc/.well-known/openid-configuration', 'https://api.example.com/.well-known/openid-configuration']);
  });

  it('appends a fallback base URL candidate when supplied', () => {
    const candidates = buildOidcDiscoveryCandidates({ issuer: 'https://api.example.com/oidc', fallbackBaseUrl: 'https://api.example.com/api' });
    expect(candidates).toContain('https://api.example.com/api/.well-known/openid-configuration');
  });

  it('de-duplicates identical candidates', () => {
    const candidates = buildOidcDiscoveryCandidates({ issuer: 'https://api.example.com' });
    expect(candidates).toEqual(['https://api.example.com/.well-known/openid-configuration']);
  });
});

describe('buildAuthorizationUrl()', () => {
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

  it('defaults the scope to openid when none is provided', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    expect(new URL(url).searchParams.get('scope')).toBe('openid');
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

  it('adds prompt=consent when offline_access is requested', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      scopes: 'openid demo offline_access',
      state: 'xyz',
      codeChallenge: 'chal'
    });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
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
    expect(new URL(url).searchParams.get('dbx_session_ttl')).toBe(String(60 * 60 * 24 * 30));
  });

  it('throws when requestedSessionTtlSeconds is not a positive integer', () => {
    const baseInput = {
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    };
    expect(() => buildAuthorizationUrl({ ...baseInput, requestedSessionTtlSeconds: -1 })).toThrow();
    expect(() => buildAuthorizationUrl({ ...baseInput, requestedSessionTtlSeconds: 12.5 })).toThrow();
  });
});

describe('parseAuthorizationRedirect()', () => {
  it('extracts code and state from a redirect URL', () => {
    const result = parseAuthorizationRedirect({ url: 'https://example.com/callback?code=abc123&state=xyz' });
    expect(result).toEqual({ code: 'abc123', state: 'xyz' });
  });

  it('returns the code when given a bare code string', () => {
    expect(parseAuthorizationRedirect({ url: 'plain-code' })).toEqual({ code: 'plain-code' });
  });

  it('throws on a state mismatch', () => {
    expect(() => parseAuthorizationRedirect({ url: 'https://example.com/callback?code=a&state=wrong', expectedState: 'right' })).toThrow();
  });

  it('accepts a matching state', () => {
    const result = parseAuthorizationRedirect({ url: 'https://example.com/callback?code=a&state=right', expectedState: 'right' });
    expect(result).toEqual({ code: 'a', state: 'right' });
  });

  it('throws when the URL carries an error param', () => {
    expect(() => parseAuthorizationRedirect({ url: 'https://example.com/callback?error=access_denied' })).toThrow();
  });

  it('throws when the input is empty', () => {
    expect(() => parseAuthorizationRedirect({ url: '   ' })).toThrow();
  });
});
