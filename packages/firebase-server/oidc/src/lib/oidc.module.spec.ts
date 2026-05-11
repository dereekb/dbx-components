import { describe, it, expect } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { oidcModuleConfigFactory, OIDC_JWKS_ENCRYPTION_SECRET_ENV_KEY } from './oidc.module';
import { type OidcModuleConfig } from './oidc.config';

const TEST_ENCRYPTION_SECRET = `54686520717569636b2062726f776e20f09fa68a206a756d7073206f76657220`;

function makeConfigService(): ConfigService {
  return {
    get: (key: string) => (key === OIDC_JWKS_ENCRYPTION_SECRET_ENV_KEY ? TEST_ENCRYPTION_SECRET : undefined)
  } as unknown as ConfigService;
}

function makeEnvService(overrides: Partial<FirebaseServerEnvService> = {}): FirebaseServerEnvService {
  return {
    isProduction: true,
    isStaging: false,
    isTestingEnv: false,
    appUrl: 'https://app.example.com',
    appApiUrl: undefined,
    appWebhookUrl: undefined,
    isApiEnabled: true,
    isWebhooksEnabled: false,
    appUrlDetails: undefined,
    developerToolsEnabled: false,
    developmentSchedulerEnabled: false,
    ...overrides
  } as unknown as FirebaseServerEnvService;
}

describe('oidcModuleConfigFactory()', () => {
  it('derives the issuer from appUrl when appApiUrl is not set', () => {
    const config = oidcModuleConfigFactory(makeConfigService(), makeEnvService());
    expect(config.issuer).toBe('https://app.example.com/oidc');
  });

  it('still uses appUrl when appApiUrl points at the same origin (e.g. the default `${appUrl}/api`)', () => {
    const config = oidcModuleConfigFactory(makeConfigService(), makeEnvService({ appApiUrl: 'https://app.example.com/api' }));
    expect(config.issuer).toBe('https://app.example.com/oidc');
  });

  it('roots the issuer at the appApiUrl origin when it differs from appUrl', () => {
    const config = oidcModuleConfigFactory(makeConfigService(), makeEnvService({ appApiUrl: 'https://api.example.com/api' }));
    expect(config.issuer).toBe('https://api.example.com/oidc');
  });

  it('strips any path on appApiUrl and only uses the origin for the issuer', () => {
    const config = oidcModuleConfigFactory(makeConfigService(), makeEnvService({ appApiUrl: 'https://api.example.com' }));
    expect(config.issuer).toBe('https://api.example.com/oidc');
  });

  it('throws when appUrl is missing', () => {
    expect(() => oidcModuleConfigFactory(makeConfigService(), makeEnvService({ appUrl: undefined }))).toThrow(/appUrl is required/);
  });
});

describe('config.issuer override on oidcModuleMetadata', () => {
  it('the factory-result spread lets an explicit issuer win', () => {
    // Mirrors the spread inside `oidcModuleMetadata`'s OidcModuleConfig useFactory:
    //   result = { ...moduleConfig, ...config }
    const moduleConfig = oidcModuleConfigFactory(makeConfigService(), makeEnvService());
    const override: Partial<OidcModuleConfig> = { issuer: 'https://canonical.example.com/oidc' };
    const result = { ...moduleConfig, ...override };
    expect(result.issuer).toBe('https://canonical.example.com/oidc');
  });
});
