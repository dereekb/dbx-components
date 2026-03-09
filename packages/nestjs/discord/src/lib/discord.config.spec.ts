import { DiscordServiceConfig } from './discord.config';

describe('DiscordServiceConfig', () => {
  describe('assertValidConfig', () => {
    it('should not throw when a bot token is provided', () => {
      const config: DiscordServiceConfig = {
        discord: {
          botToken: 'test-bot-token'
        }
      };

      expect(() => DiscordServiceConfig.assertValidConfig(config)).not.toThrow();
    });

    it('should throw when the bot token is empty', () => {
      const config: DiscordServiceConfig = {
        discord: {
          botToken: ''
        }
      };

      expect(() => DiscordServiceConfig.assertValidConfig(config)).toThrow('No Discord bot token specified.');
    });
  });
});
