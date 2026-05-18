import { describe, it, expect } from 'vitest';
import { configuredProducts, resolveProductCredentials, type ZohoCliConfig } from './cli.config';

const fullCreds = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'token'
};

describe('resolveProductCredentials()', () => {
  it('should resolve credentials from shared when product-specific is absent', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds, region: 'us', apiMode: 'production' } };
    const resolved = resolveProductCredentials(config, 'crm');
    expect(resolved).toBeDefined();
    expect(resolved?.clientId).toBe('id');
    expect(resolved?.region).toBe('us');
    expect(resolved?.apiMode).toBe('production');
  });

  it('should prefer product-specific credentials over shared', () => {
    const config: ZohoCliConfig = {
      shared: { ...fullCreds },
      crm: { clientId: 'crm-id', clientSecret: 'crm-secret', refreshToken: 'crm-token', apiUrl: 'sandbox' }
    };
    const resolved = resolveProductCredentials(config, 'crm');
    expect(resolved?.clientId).toBe('crm-id');
    expect(resolved?.apiMode).toBe('sandbox');
  });

  it('should return undefined when no credentials are available', () => {
    const config: ZohoCliConfig = { shared: { clientId: '', clientSecret: '', refreshToken: '' } };
    expect(resolveProductCredentials(config, 'crm')).toBeUndefined();
  });
});

describe('configuredProducts()', () => {
  it('should return products with fully resolvable credentials', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds } };
    expect(configuredProducts(config)).toEqual(['recruit', 'crm']);
  });

  it('should include desk only when orgId is set', () => {
    const withoutOrg: ZohoCliConfig = { shared: { ...fullCreds } };
    expect(configuredProducts(withoutOrg).includes('desk')).toBe(false);

    const withOrg: ZohoCliConfig = { shared: { ...fullCreds }, desk: { orgId: 'org-1' } };
    expect(configuredProducts(withOrg).includes('desk')).toBe(true);
  });

  it('should exclude all products when credentials are missing', () => {
    const config: ZohoCliConfig = { shared: { clientId: '', clientSecret: '', refreshToken: '' } };
    expect(configuredProducts(config)).toEqual([]);
  });
});
