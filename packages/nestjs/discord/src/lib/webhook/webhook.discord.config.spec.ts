import { DiscordWebhookServiceConfig } from './webhook.discord.config';

describe('DiscordWebhookServiceConfig', () => {
  describe('assertValidConfig', () => {
    it('should not throw when a public key is provided', () => {
      const config: DiscordWebhookServiceConfig = {
        discordWebhook: {
          publicKey: 'abc123def456'
        }
      };

      expect(() => DiscordWebhookServiceConfig.assertValidConfig(config)).not.toThrow();
    });

    it('should throw when the public key is empty', () => {
      const config: DiscordWebhookServiceConfig = {
        discordWebhook: {
          publicKey: ''
        }
      };

      expect(() => DiscordWebhookServiceConfig.assertValidConfig(config)).toThrow('No Discord public key specified.');
    });
  });
});
