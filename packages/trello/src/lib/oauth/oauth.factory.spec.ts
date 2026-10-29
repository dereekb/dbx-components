import { describe, expect, it } from 'vitest';
import { trelloOAuthFactory } from './oauth.factory';

describe('trelloOAuthFactory()', () => {
  it('should throw when the client id is missing', () => {
    expect(() => trelloOAuthFactory()({ clientId: '', clientSecret: 'secret' })).toThrow('clientId');
  });

  it('should throw when the client secret is missing', () => {
    expect(() => trelloOAuthFactory()({ clientId: 'id', clientSecret: '' })).toThrow('clientSecret');
  });

  it('should build a context carrying the config', () => {
    const { oauthContext } = trelloOAuthFactory()({ clientId: 'id', clientSecret: 'secret' });
    expect(oauthContext.config.clientId).toBe('id');
  });
});
