import { describe, it, expect } from 'vitest';
import { OpenRouterWebhookServiceConfig } from './webhook.openrouter.config';

describe('OpenRouterWebhookServiceConfig', () => {
  describe('assertValidConfig', () => {
    it('does not throw when a webhook secret is provided', () => {
      const config: OpenRouterWebhookServiceConfig = {
        openrouterWebhook: {
          webhookSecret: 'a-secret-token'
        }
      };

      expect(() => OpenRouterWebhookServiceConfig.assertValidConfig(config)).not.toThrow();
    });

    it('throws when the webhook secret is empty', () => {
      const config: OpenRouterWebhookServiceConfig = {
        openrouterWebhook: {
          webhookSecret: ''
        }
      };

      expect(() => OpenRouterWebhookServiceConfig.assertValidConfig(config)).toThrow('No OpenRouter webhook secret specified.');
    });
  });
});
