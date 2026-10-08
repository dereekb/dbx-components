import { describe, expect, it } from 'vitest';
import { ZOHO_ACCOUNTS_PROFILE_READ_SCOPE } from '@dereekb/zoho';
import { DEFAULT_AUTH_LOGIN_REDIRECT_URI, ZOHO_CLI_PRODUCT_SCOPES, ZOHO_CLI_REGION_CHOICES, parseZohoAuthRedirect, zohoCliScopesForProducts } from './cli.oauth';

describe('parseZohoAuthRedirect()', () => {
  const redirect = (params: Record<string, string>) => `${DEFAULT_AUTH_LOGIN_REDIRECT_URI}?${new URLSearchParams(params).toString()}`;

  it('should take the datacenter from accounts-server', () => {
    const result = parseZohoAuthRedirect({ pasted: redirect({ code: 'abc', state: 's1', location: 'eu', 'accounts-server': 'https://accounts.zoho.eu' }), expectedState: 's1', fallbackRegion: 'us' });

    expect(result.code).toBe('abc');
    expect(result.region).toBe('eu');
  });

  // the accounts-server host becomes the POST target the client secret is sent to
  it('should reject an accounts-server that is not a known Zoho Accounts host', () => {
    expect(() => parseZohoAuthRedirect({ pasted: redirect({ code: 'abc', state: 's1', 'accounts-server': 'https://accounts.evil.example' }), expectedState: 's1', fallbackRegion: 'us' })).toThrow(/not a known Zoho Accounts host/);
  });

  it('should fall back to the location key without an accounts-server', () => {
    expect(parseZohoAuthRedirect({ pasted: redirect({ code: 'abc', location: 'au' }), fallbackRegion: 'us' }).region).toBe('au');
  });

  it('should ignore an unknown location key', () => {
    expect(parseZohoAuthRedirect({ pasted: redirect({ code: 'abc', location: 'mars' }), fallbackRegion: 'in' }).region).toBe('in');
  });

  it('should reject a state mismatch', () => {
    expect(() => parseZohoAuthRedirect({ pasted: redirect({ code: 'abc', state: 'other' }), expectedState: 's1', fallbackRegion: 'us' })).toThrow();
  });

  it('should surface a provider error', () => {
    expect(() => parseZohoAuthRedirect({ pasted: redirect({ error: 'access_denied' }), expectedState: 's1', fallbackRegion: 'us' })).toThrow(/access_denied/);
  });

  it('should accept a bare code with the fallback region', () => {
    expect(parseZohoAuthRedirect({ pasted: ' 1000.abc.def ', fallbackRegion: 'jp' })).toEqual({ code: '1000.abc.def', region: 'jp' });
  });
});

describe('zohoCliScopesForProducts()', () => {
  it('should include the profile scope so the login can report its account', () => {
    expect(zohoCliScopesForProducts(['sign'])).toEqual([...ZOHO_CLI_PRODUCT_SCOPES.sign, ZOHO_ACCOUNTS_PROFILE_READ_SCOPE]);
  });

  it('should de-duplicate repeated products', () => {
    const scopes = zohoCliScopesForProducts(['crm', 'crm', 'recruit']);

    expect(scopes).toEqual([...new Set(scopes)]);
    expect(scopes.length).toBe(ZOHO_CLI_PRODUCT_SCOPES.crm.length + ZOHO_CLI_PRODUCT_SCOPES.recruit.length + 1);
  });

  it('should skip unknown products', () => {
    expect(zohoCliScopesForProducts(['crm', 'nope'])).toEqual([...ZOHO_CLI_PRODUCT_SCOPES.crm, ZOHO_ACCOUNTS_PROFILE_READ_SCOPE]);
  });

  it('should throw when no valid product is given', () => {
    expect(() => zohoCliScopesForProducts([])).toThrow(/No valid products/);
    expect(() => zohoCliScopesForProducts(['nope'])).toThrow(/No valid products/);
  });
});

describe('ZOHO_CLI_REGION_CHOICES', () => {
  it('should include every Zoho datacenter', () => {
    expect(ZOHO_CLI_REGION_CHOICES).toEqual(expect.arrayContaining(['us', 'eu', 'in', 'au', 'jp', 'uk', 'ca', 'sa']));
  });
});

describe('DEFAULT_AUTH_LOGIN_REDIRECT_URI', () => {
  it('should be a loopback URI on the suggested CLI port', () => {
    expect(DEFAULT_AUTH_LOGIN_REDIRECT_URI).toBe('http://localhost:8976/callback');
  });
});
