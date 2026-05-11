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

  it('rebases onto the oidcIssuer origin when appClientUrl is missing (single-host: no-op)', () => {
    // Single-host OIDC split: the API serves OIDC at `${origin}/oidc/*` (NestJS excludes it from
    // the `/api` global prefix). oidcIssuer origin matches the discovered endpoint origin, so the
    // rebase is a no-op and the CLI ends up at the discovered `/oidc/auth` URL.
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
    expect(parsed.origin + parsed.pathname).toBe('https://api.example.com/oidc/auth');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('state')).toBe('xyz');
  });

  it('reads only the origin from oidcIssuer when used as a rebase fallback', () => {
    // Path on oidcIssuer is ignored — only the origin matters for rebasing. Trailing slashes
    // on the source URL don't affect the resulting origin.
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://api.example.com/oidc/auth',
      oidcIssuer: 'https://api.example.com/oidc/',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.example.com/oidc/auth');
  });

  it('prefers oidcIssuer over apiBaseUrl as the rebase fallback origin', () => {
    // Both resolve to the same origin in this example; the assertion is the resulting URL ends
    // up at `/oidc/auth` either way (no `/oidc/login/client` shortcut anywhere).
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
    expect(parsed.origin + parsed.pathname).toBe('https://api.example.com/oidc/auth');
  });

  it('rebases onto the apiBaseUrl origin when appClientUrl and oidcIssuer are missing', () => {
    // apiBaseUrl path (`/dereekb-components/.../api`) is ignored; only the origin is used to
    // rebase the discovered authorization endpoint.
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'http://localhost:9902/dereekb-components/us-central1/api/oidc/auth',
      apiBaseUrl: 'http://localhost:9902/dereekb-components/us-central1/api',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://localhost:9902/dereekb-components/us-central1/api/oidc/auth');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('state')).toBe('xyz');
  });

  it('rebases the discovered endpoint origin when only apiBaseUrl differs in origin', () => {
    // apiBaseUrl on a different origin than the discovered endpoint rebases the user-facing URL
    // onto the apiBaseUrl origin (path preserved). This preserves the legacy "send the user
    // through the API origin" intent without using the broken `/oidc/login/client` shortcut.
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://discovery.example.com/oidc/auth',
      apiBaseUrl: 'https://example.com/api/',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/oidc/auth');
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

  it('adds prompt=consent when offline_access is in the requested scopes', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      scopes: 'openid demo offline_access',
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('prompt')).toBe('consent');
  });

  it('omits prompt when offline_access is not requested', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oidc/auth',
      clientId: 'cid',
      redirectUri: OAUTH_OOB_REDIRECT_URI,
      scopes: 'openid demo',
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('prompt')).toBe(false);
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
