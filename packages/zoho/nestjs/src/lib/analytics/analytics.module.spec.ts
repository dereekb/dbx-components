import { describe, it, expect, beforeEach } from 'vitest';
import { Module } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZohoAnalyticsApi } from './analytics.api';
import { ZohoAnalyticsServiceConfig } from './analytics.config';
import { ZOHO_ANALYTICS_ORG_ID_CONFIG_KEY, appZohoAnalyticsModuleMetadata, zohoAnalyticsServiceConfigFactory } from './analytics.module';
import { ZohoAccountsServiceConfig } from '../accounts/accounts.config';
import { ZohoAccountsAccessTokenCacheService, memoryZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';

const TEST_ORG_ID = '671712892';

/**
 * Module supplying the one dependency {@link appZohoAnalyticsModuleMetadata} does not provide itself.
 */
@Module({
  providers: [{ provide: ZohoAccountsAccessTokenCacheService, useValue: memoryZohoAccountsAccessTokenCacheService() }],
  exports: [ZohoAccountsAccessTokenCacheService]
})
export class TestZohoAnalyticsDependencyModule {}

/**
 * Config overrides so the module's wiring can be asserted without environment variables or a live
 * Zoho account. Caller-supplied providers are merged after the generated ones, so these win.
 */
const testConfigProviders = [
  { provide: ZohoAnalyticsServiceConfig, useValue: { zohoAnalytics: { apiUrl: 'production', orgId: TEST_ORG_ID } } },
  { provide: ZohoAccountsServiceConfig, useValue: { zohoAccounts: { serviceAccessTokenKey: 'analytics', apiUrl: 'https://accounts.zoho.com', refreshToken: 'refresh', clientId: 'client', clientSecret: 'secret' } } }
];

@Module(appZohoAnalyticsModuleMetadata({ dependencyModule: TestZohoAnalyticsDependencyModule, providers: testConfigProviders }))
export class TestZohoAnalyticsModule {}

@Module(appZohoAnalyticsModuleMetadata({ providers: testConfigProviders }))
export class TestZohoAnalyticsModuleWithoutDependency {}

describe('appZohoAnalyticsModuleMetadata()', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    nest = await Test.createTestingModule({ imports: [{ module: TestZohoAnalyticsModule, global: true }] }).compile();
  });

  it('should provide an injectable ZohoAnalyticsApi', () => {
    expect(nest.get(ZohoAnalyticsApi)).toBeDefined();
  });

  it('should resolve the production api url onto the analytics context', () => {
    const api = nest.get(ZohoAnalyticsApi);
    expect(api.analyticsContext.config.apiUrl).toBe('https://analyticsapi.zoho.com/restapi/v2');
  });

  it('should carry the configured org id onto the analytics context', () => {
    const api = nest.get(ZohoAnalyticsApi);
    expect(api.analyticsContext.config.orgId).toBe(TEST_ORG_ID);
  });

  it('should expose a shared rate limiter', () => {
    const api = nest.get(ZohoAnalyticsApi);
    expect(api.zohoRateLimiter).toBeDefined();
  });

  it('should expose the import and export operations', () => {
    const api = nest.get(ZohoAnalyticsApi);

    expect(typeof api.getOrgs).toBe('function');
    expect(typeof api.importDataInTable).toBe('function');
    expect(typeof api.importDataInTableAndAwaitJob).toBe('function');
    expect(typeof api.exportData).toBe('function');
    expect(typeof api.getTableMetadata).toBe('function');
  });

  it('should fail to compile when ZohoAccountsAccessTokenCacheService is not provided', async () => {
    await expect(Test.createTestingModule({ imports: [{ module: TestZohoAnalyticsModuleWithoutDependency, global: true }] }).compile()).rejects.toThrow();
  });
});

/**
 * Builds a stub ConfigService backed by the given environment map.
 */
function mockConfigService(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('zohoAnalyticsServiceConfigFactory()', () => {
  it('should read the service-specific api url and org id', () => {
    const config = zohoAnalyticsServiceConfigFactory(mockConfigService({ ZOHO_ANALYTICS_API_URL: 'production', ZOHO_ANALYTICS_ORG_ID: TEST_ORG_ID }));

    expect(config.zohoAnalytics.apiUrl).toBe('production');
    expect(config.zohoAnalytics.orgId).toBe(TEST_ORG_ID);
  });

  it('should fall back to the shared api url and org id keys', () => {
    const config = zohoAnalyticsServiceConfigFactory(mockConfigService({ ZOHO_API_URL: 'production', ZOHO_ORG_ID: TEST_ORG_ID }));

    expect(config.zohoAnalytics.apiUrl).toBe('production');
    expect(config.zohoAnalytics.orgId).toBe(TEST_ORG_ID);
  });

  it('should prefer the service-specific org id over the shared one', () => {
    const config = zohoAnalyticsServiceConfigFactory(mockConfigService({ ZOHO_API_URL: 'production', ZOHO_ANALYTICS_ORG_ID: TEST_ORG_ID, ZOHO_ORG_ID: 'other' }));

    expect(config.zohoAnalytics.orgId).toBe(TEST_ORG_ID);
  });

  it('should not require an org id, since getOrgs() is what discovers it', () => {
    const config = zohoAnalyticsServiceConfigFactory(mockConfigService({ ZOHO_API_URL: 'production' }));

    expect(config.zohoAnalytics.apiUrl).toBe('production');
    expect(config.zohoAnalytics.orgId).toBeUndefined();
  });

  it('should throw when no api url is configured', () => {
    expect(() => zohoAnalyticsServiceConfigFactory(mockConfigService({}))).toThrow();
  });

  it('should use ORG_ID as the org id config key suffix', () => {
    expect(ZOHO_ANALYTICS_ORG_ID_CONFIG_KEY).toBe('ORG_ID');
  });
});
