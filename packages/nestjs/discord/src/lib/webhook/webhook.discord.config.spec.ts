import { DiscordWebhookServiceConfig } from './webhook.discord.config';

/**
 * A valid 64-character hex string representing a 32-byte Ed25519 public key.
 */
const VALID_PUBLIC_KEY = 'a'.repeat(64);

describe('DiscordWebhookServiceConfig', () => {
  describe('assertValidConfig', () => {
    it('should not throw when a valid 64-char hex public key is provided', () => {
      const config: DiscordWebhookServiceConfig = {
        discordWebhook: {
          publicKey: VALID_PUBLIC_KEY
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

    it('should throw when the public key is not a valid 64-char hex string', () => {
      const config: DiscordWebhookServiceConfig = {
        discordWebhook: {
          publicKey: 'placeholder'
        }
      };

      expect(() => DiscordWebhookServiceConfig.assertValidConfig(config)).toThrow('not available or is invalid');
    });

    it('should throw when the public key is too short', () => {
      const config: DiscordWebhookServiceConfig = {
        discordWebhook: {
          publicKey: 'abc123'
        }
      };

      expect(() => DiscordWebhookServiceConfig.assertValidConfig(config)).toThrow('not available or is invalid');
    });
  });
});
