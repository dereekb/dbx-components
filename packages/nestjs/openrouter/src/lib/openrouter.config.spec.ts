import { describe, it, expect } from 'vitest';
import { OpenRouterServiceConfig } from './openrouter.config';

describe('OpenRouterServiceConfig', () => {
  describe('assertValidConfig', () => {
    it('does not throw when an api key is provided', () => {
      const config: OpenRouterServiceConfig = {
        openrouter: {
          apiKey: 'sk-or-v1-test'
        }
      };

      expect(() => OpenRouterServiceConfig.assertValidConfig(config)).not.toThrow();
    });

    it('does not throw when an optional serverURL is provided', () => {
      const config: OpenRouterServiceConfig = {
        openrouter: {
          apiKey: 'sk-or-v1-test',
          serverURL: 'https://example.com/api/v1'
        }
      };

      expect(() => OpenRouterServiceConfig.assertValidConfig(config)).not.toThrow();
    });

    it('throws when the api key is missing', () => {
      const config: OpenRouterServiceConfig = {
        openrouter: {
          apiKey: ''
        }
      };

      expect(() => OpenRouterServiceConfig.assertValidConfig(config)).toThrow('No OpenRouter API key specified.');
    });
  });
});
