import { beforeEach, describe, expect, it } from 'vitest';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZOHO_ACCOUNTS_EU_API_URL, ZOHO_ACCOUNTS_US_API_URL } from '@dereekb/zoho';
import { ZohoAccountsOAuthApi } from './accounts.oauth.api';
import { ZOHO_ACCOUNTS_CLIENT_ID_CONFIG_KEY, ZOHO_ACCOUNTS_CLIENT_SECRET_CONFIG_KEY, ZOHO_ACCOUNTS_URL_CONFIG_KEY, ZohoAccountsOAuthServiceConfig, zohoAccountsOAuthServiceConfigFactory } from './accounts.oauth.config';
import { appZohoAccountsOAuthModuleMetadata } from './accounts.oauth.module';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';

/**
 * A ConfigService stub holding only the three ZOHO_ACCOUNTS_* keys, so the module is exercised
 * against the same env surface it reads in production.
 *
 * @param values - The environment values to serve.
 * @returns A ConfigService-shaped stub.
 */
function configServiceStub(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const ENV_VALUES: Record<string, string | undefined> = {
  [ZOHO_ACCOUNTS_CLIENT_ID_CONFIG_KEY]: TEST_CLIENT_ID,
  [ZOHO_ACCOUNTS_CLIENT_SECRET_CONFIG_KEY]: TEST_CLIENT_SECRET,
  [ZOHO_ACCOUNTS_URL_CONFIG_KEY]: 'us'
};

@Module(appZohoAccountsOAuthModuleMetadata({}))
class TestZohoAccountsOAuthModule {}

describe('zohoAccountsOAuthServiceConfigFactory()', () => {
  it('should read the three flat ZOHO_ACCOUNTS_* keys', () => {
    const config = zohoAccountsOAuthServiceConfigFactory(configServiceStub(ENV_VALUES));

    expect(config.zohoAccountsOAuth.clientId).toBe(TEST_CLIENT_ID);
    expect(config.zohoAccountsOAuth.clientSecret).toBe(TEST_CLIENT_SECRET);
    expect(config.zohoAccountsOAuth.apiUrl).toBe('us');
  });

  it('should coerce an empty configured value to undefined', () => {
    expect(() => zohoAccountsOAuthServiceConfigFactory(configServiceStub({ ...ENV_VALUES, [ZOHO_ACCOUNTS_URL_CONFIG_KEY]: '' }))).not.toThrow();
    expect(zohoAccountsOAuthServiceConfigFactory(configServiceStub({ ...ENV_VALUES, [ZOHO_ACCOUNTS_URL_CONFIG_KEY]: '' })).zohoAccountsOAuth.apiUrl).toBeUndefined();
  });
});

describe('ZohoAccountsOAuthServiceConfig.assertValidConfig()', () => {
  it('should throw without a client id', () => {
    expect(() => ZohoAccountsOAuthServiceConfig.assertValidConfig({ zohoAccountsOAuth: { clientSecret: TEST_CLIENT_SECRET } })).toThrow();
  });

  it('should throw without a client secret', () => {
    expect(() => ZohoAccountsOAuthServiceConfig.assertValidConfig({ zohoAccountsOAuth: { clientId: TEST_CLIENT_ID } })).toThrow();
  });
});

describe('ZohoAccountsOAuthApi', () => {
  let nest: TestingModule;
  let api: ZohoAccountsOAuthApi;

  beforeEach(async () => {
    nest = await Test.createTestingModule({ imports: [TestZohoAccountsOAuthModule] })
      .overrideProvider(ConfigService)
      .useValue(configServiceStub(ENV_VALUES))
      .compile();

    api = nest.get(ZohoAccountsOAuthApi);
  });

  it('should compile the module and expose the api', () => {
    expect(api).toBeDefined();
    expect(api.clientId).toBe(TEST_CLIENT_ID);
  });

  it('should resolve the configured datacenter key to its host', () => {
    expect(api.apiUrl).toBe(ZOHO_ACCOUNTS_US_API_URL);
  });

  it('should memoize the client for a repeated host', () => {
    expect(api.oauthClientContextForApiUrl(ZOHO_ACCOUNTS_US_API_URL)).toBe(api.oauthClientContextForApiUrl(ZOHO_ACCOUNTS_US_API_URL));
    // the default accessor resolves to the same configured host
    expect(api.oauthClientContext).toBe(api.oauthClientContextForApiUrl('us'));
  });

  it('should build a distinct client for a different host', () => {
    // a code issued by one datacenter cannot be exchanged at another
    expect(api.oauthClientContextForApiUrl(ZOHO_ACCOUNTS_EU_API_URL)).not.toBe(api.oauthClientContextForApiUrl(ZOHO_ACCOUNTS_US_API_URL));
  });
});
