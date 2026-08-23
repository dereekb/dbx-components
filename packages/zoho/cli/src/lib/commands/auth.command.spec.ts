import { describe, expect, it } from 'vitest';
import { authProductConfigUpdate, authSetupScopes, buildAuthShowResult } from './auth.command';
import { type ZohoCliConfig } from '../config/cli.config';

describe('authSetupScopes()', () => {
  it('should use the explicit scopes when given', () => {
    expect(authSetupScopes('recruit,crm', 'analytics')).toEqual(['recruit', 'crm']);
  });

  it('should trim the explicit scopes', () => {
    expect(authSetupScopes('recruit, crm ', undefined)).toEqual(['recruit', 'crm']);
  });

  // a dedicated-client product authorized under the default trio gets a token without its own
  // scopes, and every later call fails as an invalid token rather than as a setup mistake
  it('should default to the targeted product', () => {
    expect(authSetupScopes(undefined, 'analytics')).toEqual(['analytics']);
    expect(authSetupScopes(undefined, 'sign')).toEqual(['sign']);
  });

  it('should default to the shared products when no product is targeted', () => {
    expect(authSetupScopes(undefined, undefined)).toEqual(['recruit', 'crm', 'desk']);
  });
});

describe('authProductConfigUpdate()', () => {
  const credentials = { clientId: 'id', clientSecret: 'secret' };

  it('should carry the org id for every org-scoped product', () => {
    expect(authProductConfigUpdate({ product: 'analytics', credentials, orgId: '783021215' }).orgId).toBe('783021215');
    expect(authProductConfigUpdate({ product: 'desk', credentials, orgId: '783021215' }).orgId).toBe('783021215');
  });

  it('should drop the org id for a product that is not org-scoped', () => {
    expect(authProductConfigUpdate({ product: 'recruit', credentials, orgId: '783021215' }).orgId).toBeUndefined();
    expect(authProductConfigUpdate({ product: 'sign', credentials, orgId: '783021215' }).orgId).toBeUndefined();
  });

  it('should carry the credentials and api mode through', () => {
    const update = authProductConfigUpdate({ product: 'analytics', credentials: { ...credentials, refreshToken: 'refresh' }, apiMode: 'sandbox' });

    expect(update.clientId).toBe('id');
    expect(update.refreshToken).toBe('refresh');
    expect(update.apiUrl).toBe('sandbox');
  });
});

describe('buildAuthShowResult()', () => {
  const config: ZohoCliConfig = {
    shared: { clientId: 'shared-id', clientSecret: 'shared-secret', refreshToken: 'shared-token', region: 'us', apiMode: 'production' },
    analytics: { clientId: 'analytics-id', clientSecret: 'analytics-secret', refreshToken: 'analytics-token', apiUrl: 'production', orgId: '783021215' },
    desk: { orgId: 'org-1' }
  };

  // a fully working analytics install reported nothing here, because the result was a hand-written
  // per-product literal that analytics was never added to
  it('should report the analytics block including its org id', () => {
    const result = buildAuthShowResult(config) as Record<string, Record<string, unknown>>;

    expect(result['analytics']).toBeTruthy();
    expect(result['analytics']?.['orgId']).toBe('783021215');
    expect(result['analytics']?.['apiUrl']).toBe('production');
  });

  it('should report a block for every product, and null for the unconfigured ones', () => {
    const result = buildAuthShowResult(config) as Record<string, unknown>;

    expect(result['desk']).toBeTruthy();
    expect(result['recruit']).toBeNull();
    expect(result['crm']).toBeNull();
    expect(result['sign']).toBeNull();
  });

  it('should surface orgId only for the org-scoped products', () => {
    const withRecruit = buildAuthShowResult({ ...config, recruit: { clientId: 'recruit-id', clientSecret: 'recruit-secret', refreshToken: 'recruit-token' } }) as Record<string, Record<string, unknown>>;

    expect(Object.keys(withRecruit['desk'] ?? {})).toContain('orgId');
    expect(Object.keys(withRecruit['recruit'] ?? {})).not.toContain('orgId');
  });

  it('should mask every secret it reports', () => {
    const result = buildAuthShowResult(config) as Record<string, Record<string, unknown>>;

    expect(result['analytics']?.['clientSecret']).not.toBe('analytics-secret');
    expect(result['analytics']?.['refreshToken']).not.toBe('analytics-token');
    expect(result['shared']?.['clientSecret']).not.toBe('shared-secret');
    expect(JSON.stringify(result)).not.toContain('analytics-token');
  });

  it('should include the configured products', () => {
    expect((buildAuthShowResult(config) as Record<string, unknown>)['configuredProducts']).toEqual(['recruit', 'crm', 'desk', 'analytics']);
  });
});
