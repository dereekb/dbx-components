import { describe, expect, it } from 'vitest';
import { TrelloWebhookServiceConfig } from './webhook.trello.config';

describe('TrelloWebhookServiceConfig', () => {
  describe('assertValidConfig', () => {
    it('does not throw when an appSecret and callbackUrl are provided', () => {
      const config: TrelloWebhookServiceConfig = {
        webhookConfig: {
          appSecret: 'test-app-secret',
          callbackUrl: 'https://example.com/webhook/trello'
        }
      };

      expect(() => TrelloWebhookServiceConfig.assertValidConfig(config)).not.toThrow();
    });

    it('throws when the appSecret is empty', () => {
      const config: TrelloWebhookServiceConfig = {
        webhookConfig: {
          appSecret: '',
          callbackUrl: 'https://example.com/webhook/trello'
        }
      };

      expect(() => TrelloWebhookServiceConfig.assertValidConfig(config)).toThrow('No Trello app secret specified.');
    });

    it('throws when the callbackUrl is empty', () => {
      const config: TrelloWebhookServiceConfig = {
        webhookConfig: {
          appSecret: 'test-app-secret',
          callbackUrl: ''
        }
      };

      expect(() => TrelloWebhookServiceConfig.assertValidConfig(config)).toThrow('No Trello webhook callback URL specified.');
    });
  });
});
