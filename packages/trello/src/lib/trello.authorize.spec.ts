import { describe, expect, it } from 'vitest';
import { TRELLO_API_TOKEN_AUTHORIZE_URL, trelloApiTokenAuthorizeUrl } from './trello.authorize';

describe('trelloApiTokenAuthorizeUrl()', () => {
  it('should ask for a read token that never expires by default', () => {
    const url = trelloApiTokenAuthorizeUrl({ apiKey: 'key-1' });
    expect(url).toBe(`${TRELLO_API_TOKEN_AUTHORIZE_URL}?key=key-1&response_type=token&scope=read&expiration=never`);
  });

  it('should keep literal commas between scopes and encode the name', () => {
    const url = new URL(trelloApiTokenAuthorizeUrl({ apiKey: 'key-1', scopes: ['read', 'write'], expiration: '30days', name: 'my cli' }));
    expect(url.search).toContain('scope=read,write');
    expect(url.searchParams.get('expiration')).toBe('30days');
    expect(url.searchParams.get('name')).toBe('my cli');
  });
});
