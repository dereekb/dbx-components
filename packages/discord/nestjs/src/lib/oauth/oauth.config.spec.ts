import { describe, expect, it } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { DISCORD_CLIENT_ID_CONFIG_KEY, DISCORD_CLIENT_SECRET_CONFIG_KEY, DiscordOAuthServiceConfig, discordOAuthServiceConfigFactory } from './oauth.config';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';

/**
 * Builds the config factory over an arbitrary set of env values, so a missing credential can be
 * exercised without standing up a module.
 */
function configFactoryWith(values: Record<string, string>) {
  return () => discordOAuthServiceConfigFactory({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('discordOAuthServiceConfigFactory()', () => {
  it('should read both credentials from the config service', () => {
    const config = configFactoryWith({ [DISCORD_CLIENT_ID_CONFIG_KEY]: TEST_CLIENT_ID, [DISCORD_CLIENT_SECRET_CONFIG_KEY]: TEST_CLIENT_SECRET })();

    expect(config.discordOAuth.clientId).toBe(TEST_CLIENT_ID);
    expect(config.discordOAuth.clientSecret).toBe(TEST_CLIENT_SECRET);
  });

  it('should fail at startup when no client id is configured', () => {
    // otherwise the authorize URL composes client_id=undefined and fails at the consent screen
    expect(configFactoryWith({ [DISCORD_CLIENT_SECRET_CONFIG_KEY]: TEST_CLIENT_SECRET })).toThrow(DISCORD_CLIENT_ID_CONFIG_KEY);
  });

  it('should fail at startup when no client secret is configured', () => {
    // otherwise the exchange fails only after the user has already consented
    expect(configFactoryWith({ [DISCORD_CLIENT_ID_CONFIG_KEY]: TEST_CLIENT_ID })).toThrow(DISCORD_CLIENT_SECRET_CONFIG_KEY);
  });

  it('should treat an empty credential as missing', () => {
    // an empty env var otherwise composes a Basic header authenticating as nobody
    expect(configFactoryWith({ [DISCORD_CLIENT_ID_CONFIG_KEY]: '', [DISCORD_CLIENT_SECRET_CONFIG_KEY]: TEST_CLIENT_SECRET })).toThrow(DISCORD_CLIENT_ID_CONFIG_KEY);
  });
});

describe('DiscordOAuthServiceConfig', () => {
  describe('assertedDiscordOAuthConfig()', () => {
    it('should narrow a fully configured client to a DiscordOAuthConfig', () => {
      const result = DiscordOAuthServiceConfig.assertedDiscordOAuthConfig({ discordOAuth: { clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET } });

      expect(result).toEqual({ clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET });
    });

    it('should throw when a credential is missing', () => {
      expect(() => DiscordOAuthServiceConfig.assertedDiscordOAuthConfig({ discordOAuth: { clientId: TEST_CLIENT_ID } })).toThrow(DISCORD_CLIENT_SECRET_CONFIG_KEY);
    });
  });
});
