import { describe, it, expect } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { openRouterServiceConfigFactory } from './openrouter.module';
import { OPENROUTER_API_KEY_ENV_VAR, OPENROUTER_BASE_URL_ENV_VAR, OPENROUTER_SERVER_URL_ENV_VAR } from './openrouter.config';

function stubConfigService(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('openRouterServiceConfigFactory()', () => {
  const apiKey = 'sk-or-v1-test';
  const serverUrl = 'https://server.example.com/api/v1';
  const baseUrl = 'https://base.example.com/api/v1';

  it('should use OPENROUTER_SERVER_URL over OPENROUTER_BASE_URL', () => {
    const config = openRouterServiceConfigFactory(stubConfigService({ [OPENROUTER_API_KEY_ENV_VAR]: apiKey, [OPENROUTER_SERVER_URL_ENV_VAR]: serverUrl, [OPENROUTER_BASE_URL_ENV_VAR]: baseUrl }));

    expect(config.openrouter.apiKey).toBe(apiKey);
    expect(config.openrouter.serverURL).toBe(serverUrl);
  });

  it('should use OPENROUTER_BASE_URL when OPENROUTER_SERVER_URL is unset', () => {
    const config = openRouterServiceConfigFactory(stubConfigService({ [OPENROUTER_API_KEY_ENV_VAR]: apiKey, [OPENROUTER_BASE_URL_ENV_VAR]: baseUrl }));
    expect(config.openrouter.serverURL).toBe(baseUrl);
  });

  it('should leave serverURL undefined when neither variable is set', () => {
    const config = openRouterServiceConfigFactory(stubConfigService({ [OPENROUTER_API_KEY_ENV_VAR]: apiKey }));
    expect(config.openrouter.serverURL).toBeUndefined();
  });

  it('should not read timeoutMs or retryConfig from the environment', () => {
    const config = openRouterServiceConfigFactory(stubConfigService({ [OPENROUTER_API_KEY_ENV_VAR]: apiKey }));

    expect(config.openrouter.timeoutMs).toBeUndefined();
    expect(config.openrouter.retryConfig).toBeUndefined();
  });

  it('should throw when the api key is missing', () => {
    expect(() => openRouterServiceConfigFactory(stubConfigService({ [OPENROUTER_SERVER_URL_ENV_VAR]: serverUrl }))).toThrow('No OpenRouter API key specified.');
  });
});
