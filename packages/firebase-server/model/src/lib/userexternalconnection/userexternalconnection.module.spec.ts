import { describe, expect, it } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { TESTING_USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET, USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET_ENV_KEY, userExternalConnectionModuleConfigFactory } from './userexternalconnection.module';

const TEST_ENCRYPTION_SECRET = `54686520717569636b2062726f776e20f09fa68a206a756d7073206f76657220`;

function makeConfigService(value?: string): ConfigService {
  return {
    get: (key: string) => (key === USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET_ENV_KEY ? value : undefined)
  } as unknown as ConfigService;
}

function makeEnvService(overrides: Partial<FirebaseServerEnvService> = {}): FirebaseServerEnvService {
  return {
    isProduction: true,
    isStaging: false,
    isTestingEnv: false,
    appUrl: 'https://app.example.com',
    appApiUrl: undefined,
    appMcpUrl: undefined,
    appWebhookUrl: undefined,
    isApiEnabled: true,
    isWebhooksEnabled: false,
    appUrlDetails: undefined,
    developerToolsEnabled: false,
    developmentSchedulerEnabled: false,
    ...overrides
  } as FirebaseServerEnvService;
}

describe('userExternalConnectionModuleConfigFactory()', () => {
  it('uses the configured secret', () => {
    const config = userExternalConnectionModuleConfigFactory(makeConfigService(TEST_ENCRYPTION_SECRET), makeEnvService());
    expect(config.userExternalConnectionPrivateConverterConfig.encryptionSecret).toBe(TEST_ENCRYPTION_SECRET);
  });

  it('falls back to the testing secret in a testing environment', () => {
    const config = userExternalConnectionModuleConfigFactory(makeConfigService(), makeEnvService({ isTestingEnv: true }));
    expect(config.userExternalConnectionPrivateConverterConfig.encryptionSecret).toBe(TESTING_USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET);
  });

  it('throws when the secret is missing outside a testing environment', () => {
    expect(() => userExternalConnectionModuleConfigFactory(makeConfigService(), makeEnvService())).toThrow();
  });

  it('throws when the secret is not 64 hex characters outside a testing environment', () => {
    expect(() => userExternalConnectionModuleConfigFactory(makeConfigService('not-a-valid-secret'), makeEnvService())).toThrow();
  });

  it('uses a testing secret distinct from the OIDC jwks testing secret', () => {
    expect(TESTING_USER_EXTERNAL_CONNECTION_ENCRYPTION_SECRET).not.toBe(TEST_ENCRYPTION_SECRET);
  });
});
