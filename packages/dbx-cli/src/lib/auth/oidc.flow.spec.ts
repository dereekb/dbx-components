import { describe, it, expect } from 'vitest';
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
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
      scopes: 'openid demo',
      state: 'xyz',
      codeChallenge: 'chal'
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://example.com/oidc/auth');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('redirect_uri')).toBe('urn:ietf:wg:oauth:2.0:oob');
    expect(parsed.searchParams.get('scope')).toBe('openid demo');
    expect(parsed.searchParams.get('state')).toBe('xyz');
    expect(parsed.searchParams.get('code_challenge')).toBe('chal');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
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
