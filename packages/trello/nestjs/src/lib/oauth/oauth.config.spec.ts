import { describe, expect, it } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { TRELLO_OAUTH_CLIENT_ID_CONFIG_KEY, TRELLO_OAUTH_CLIENT_SECRET_CONFIG_KEY, TrelloOAuthServiceConfig, trelloOAuthServiceConfigFactory } from './oauth.config';

function makeConfigService(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('trelloOAuthServiceConfigFactory()', () => {
  it('should read both credentials from the environment', () => {
    const config = trelloOAuthServiceConfigFactory(makeConfigService({ [TRELLO_OAUTH_CLIENT_ID_CONFIG_KEY]: 'client-id', [TRELLO_OAUTH_CLIENT_SECRET_CONFIG_KEY]: 'client-secret' }));

    expect(config.trelloOAuth.clientId).toBe('client-id');
    expect(config.trelloOAuth.clientSecret).toBe('client-secret');
  });

  it('should throw when the client id is missing', () => {
    expect(() => trelloOAuthServiceConfigFactory(makeConfigService({ [TRELLO_OAUTH_CLIENT_SECRET_CONFIG_KEY]: 'client-secret' }))).toThrow(TRELLO_OAUTH_CLIENT_ID_CONFIG_KEY);
  });

  it('should throw when the client secret is missing', () => {
    expect(() => trelloOAuthServiceConfigFactory(makeConfigService({ [TRELLO_OAUTH_CLIENT_ID_CONFIG_KEY]: 'client-id' }))).toThrow(TRELLO_OAUTH_CLIENT_SECRET_CONFIG_KEY);
  });
});

describe('TrelloOAuthServiceConfig.assertedTrelloOAuthConfig()', () => {
  it('should narrow a valid config to the core client config', () => {
    expect(TrelloOAuthServiceConfig.assertedTrelloOAuthConfig({ trelloOAuth: { clientId: 'id', clientSecret: 'secret' } })).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });
});
