import { describe, expect, it } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { MICROSOFT_OAUTH_CLIENT_ID_CONFIG_KEY, MICROSOFT_OAUTH_CLIENT_SECRET_CONFIG_KEY, MICROSOFT_OAUTH_TENANT_CONFIG_KEY, MicrosoftOAuthServiceConfig, microsoftOAuthServiceConfigFactory } from './oauth.config';
import { appMicrosoftOAuthModuleMetadata } from './oauth.module';
import { MicrosoftOAuthApi } from './oauth.api';

const VALID_ENV = { [MICROSOFT_OAUTH_CLIENT_ID_CONFIG_KEY]: 'client-id', [MICROSOFT_OAUTH_CLIENT_SECRET_CONFIG_KEY]: 'client-secret', [MICROSOFT_OAUTH_TENANT_CONFIG_KEY]: 'contoso.onmicrosoft.com' };

function makeConfigService(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('microsoftOAuthServiceConfigFactory()', () => {
  it('reads the credentials and tenant from the environment', () => {
    const config = microsoftOAuthServiceConfigFactory(makeConfigService(VALID_ENV));

    expect(config.microsoftOAuth).toEqual({ clientId: 'client-id', clientSecret: 'client-secret', tenantId: 'contoso.onmicrosoft.com' });
  });

  it.each([MICROSOFT_OAUTH_CLIENT_ID_CONFIG_KEY, MICROSOFT_OAUTH_CLIENT_SECRET_CONFIG_KEY, MICROSOFT_OAUTH_TENANT_CONFIG_KEY])('throws naming %s when it is missing', (key) => {
    expect(() => microsoftOAuthServiceConfigFactory(makeConfigService({ ...VALID_ENV, [key]: undefined }))).toThrow(key);
  });

  it('refuses a multi-tenant authority at boot', () => {
    expect(() => microsoftOAuthServiceConfigFactory(makeConfigService({ ...VALID_ENV, [MICROSOFT_OAUTH_TENANT_CONFIG_KEY]: 'common' }))).toThrow('multi-tenant');
  });
});

describe('MicrosoftOAuthServiceConfig.assertedMicrosoftOAuthConfig()', () => {
  it('narrows a valid config to the core client config', () => {
    expect(MicrosoftOAuthServiceConfig.assertedMicrosoftOAuthConfig({ microsoftOAuth: { clientId: 'id', clientSecret: 'secret', tenantId: ' tenant ' } })).toEqual({ clientId: 'id', clientSecret: 'secret', tenantId: 'tenant' });
  });
});

describe('appMicrosoftOAuthModuleMetadata()', () => {
  it('provides a MicrosoftOAuthApi bound to the configured tenant', async () => {
    @Module(appMicrosoftOAuthModuleMetadata({ microsoftOAuthServiceConfigFactory: () => ({ microsoftOAuth: { clientId: 'client-id', clientSecret: 'client-secret', tenantId: 'contoso.onmicrosoft.com' } }) }))
    class TestMicrosoftOAuthModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestMicrosoftOAuthModule] }).compile();
    const api = moduleRef.get(MicrosoftOAuthApi);

    expect(api.tenantId).toBe('contoso.onmicrosoft.com');
    expect(api.clientId).toBe('client-id');

    const url = new URL(api.authorizeUrlFactory({ redirectUri: 'http://localhost/cb' })({ scopes: ['User.Read'] }));
    expect(url.pathname).toBe('/contoso.onmicrosoft.com/oauth2/v2.0/authorize');

    await moduleRef.close();
  });
});
