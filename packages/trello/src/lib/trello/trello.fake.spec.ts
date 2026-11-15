import { describe, expect, it, vi } from 'vitest';
import { TrelloTooManyRequestsError } from '../trello.error.api';
import { getMe } from './trello.api.member';
import { getCard } from './trello.api.card';
import { fakeTrelloContext } from './trello.fake';

const ME = { id: 'member-1', username: 'me', fullName: 'Me' };

function tooManyRequestsRoute() {
  return vi.fn(() => new Response('API_TOKEN_LIMIT_EXCEEDED', { status: 429 }));
}

describe('fakeTrelloContext()', () => {
  describe('without the rate limiter (the default)', () => {
    it('answers and records a 429 route once', async () => {
      const route = tooManyRequestsRoute();
      const fake = fakeTrelloContext({ routes: { 'GET /members/me': route } });

      await expect(getMe(fake.trelloContext)()).rejects.toBeInstanceOf(TrelloTooManyRequestsError);
      expect(route).toHaveBeenCalledTimes(1);
      expect(fake.requests).toHaveLength(1);
    });

    it('does not throttle 30 back-to-back requests', async () => {
      const fake = fakeTrelloContext({ routes: { 'GET /cards/*': (request: { readonly path: string }) => ({ id: request.path.split('/')[2], name: 'A card' }) } });
      const waitForRateLimit = vi.spyOn(fake.trelloContext.trelloRateLimiter, 'waitForRateLimit');
      const startedAt = Date.now();

      for (let i = 0; i < 30; i += 1) {
        await getCard(fake.trelloContext)({ cardId: `card-${i}` });
      }

      expect(Date.now() - startedAt).toBeLessThan(1000);
      expect(fake.requests).toHaveLength(30);
      expect(waitForRateLimit).not.toHaveBeenCalled();
    });

    it('keeps the real ok-check, error translation and auth header', async () => {
      const fake = fakeTrelloContext({ routes: { 'GET /members/me': ME } });

      expect(await getMe(fake.trelloContext)()).toEqual(ME);
      expect(fake.requests[0].headers.get('Authorization')).toContain('oauth_token="fake-token"');
    });
  });

  describe('with rateLimit: true', () => {
    it('goes through the limiter and retries a 429 once', async () => {
      const route = tooManyRequestsRoute();
      const fake = fakeTrelloContext({ routes: { 'GET /members/me': route }, rateLimit: true });
      const waitForRateLimit = vi.spyOn(fake.trelloContext.trelloRateLimiter, 'waitForRateLimit');

      await expect(getMe(fake.trelloContext)()).rejects.toBeInstanceOf(TrelloTooManyRequestsError);
      expect(route).toHaveBeenCalledTimes(2);
      expect(fake.requests).toHaveLength(2);
      expect(waitForRateLimit).toHaveBeenCalledTimes(2);
    });

    it('turns on when a rateLimiterConfig is passed', async () => {
      const route = tooManyRequestsRoute();
      const fake = fakeTrelloContext({ routes: { 'GET /members/me': route }, rateLimiterConfig: { maxRateLimit: 100 } });

      await expect(getMe(fake.trelloContext)()).rejects.toBeInstanceOf(TrelloTooManyRequestsError);
      expect(route).toHaveBeenCalledTimes(2);
    });
  });
});
