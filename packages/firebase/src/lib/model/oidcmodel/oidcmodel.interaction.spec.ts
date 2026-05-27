import { describe, it, expect } from 'vitest';
import { ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS, ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS, PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD, PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD } from './oidcmodel.interaction';

describe('PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD', () => {
  it('should be "none"', () => {
    expect(PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD).toBe('none');
  });
});

describe('ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS', () => {
  it('should list all four confidential methods plus the public PKCE "none" method', () => {
    expect(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS).toEqual(['client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt', 'none']);
  });

  it('should include the public PKCE "none" method', () => {
    expect(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS).toContain(PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD);
  });

  it('should still include the existing confidential methods (additive change)', () => {
    expect(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS).toContain('client_secret_basic');
    expect(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS).toContain('client_secret_post');
    expect(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS).toContain('client_secret_jwt');
    expect(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS).toContain(PRIVATE_KEY_JWT_TOKEN_ENDPOINT_AUTH_METHOD);
  });
});

describe('ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS', () => {
  it('should offer a labeled option for the public PKCE "none" method', () => {
    const option = ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS.find((x) => x.value === PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD);
    expect(option).toBeDefined();
    expect(option?.label).toBe('None (Public PKCE)');
  });

  it('should expose one option per auth method, matching ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS', () => {
    expect(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS.map((x) => x.value)).toEqual(ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS);
  });
});
