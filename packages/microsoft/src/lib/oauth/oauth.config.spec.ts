import { describe, expect, it } from 'vitest';
import { assertMicrosoftSingleTenantId, isMicrosoftMultiTenantAuthority, microsoftOAuthTenantBaseUrl } from './oauth.config';

describe('assertMicrosoftSingleTenantId()', () => {
  it('returns a trimmed directory id', () => {
    expect(assertMicrosoftSingleTenantId(' 72f988bf-86f1-41af-91ab-2d7cd011db47 ')).toBe('72f988bf-86f1-41af-91ab-2d7cd011db47');
  });

  it('accepts a verified domain', () => {
    expect(assertMicrosoftSingleTenantId('contoso.onmicrosoft.com')).toBe('contoso.onmicrosoft.com');
  });

  it.each(['common', 'organizations', 'consumers', 'Common'])('refuses the multi-tenant authority "%s"', (authority) => {
    expect(isMicrosoftMultiTenantAuthority(authority)).toBe(true);
    expect(() => assertMicrosoftSingleTenantId(authority)).toThrow('multi-tenant');
  });

  it('refuses an empty tenant', () => {
    expect(() => assertMicrosoftSingleTenantId('')).toThrow('tenant id is required');
    expect(() => assertMicrosoftSingleTenantId(undefined)).toThrow('tenant id is required');
  });
});

describe('microsoftOAuthTenantBaseUrl()', () => {
  it('roots the v2 endpoints under the tenant', () => {
    expect(microsoftOAuthTenantBaseUrl('contoso.onmicrosoft.com')).toBe('https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0');
  });
});
