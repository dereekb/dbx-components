import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { type TrelloAccessTokenProvider, type TrelloConfig } from '../trello.config';
import { TrelloInvalidTokenError } from '../trello.error.api';
import { getMe } from './trello.api.member';
import { listWebhooksForToken } from './trello.api.webhook';
import { trelloFactory } from './trello.factory';

interface TestTrello {
  readonly requests: Request[];
  readonly context: ReturnType<ReturnType<typeof trelloFactory>>['trelloContext'];
}

/**
 * Builds a Trello context whose requests are intercepted UNDER the rate limiter, answering each with the
 * next status in `statuses` (the last one repeats).
 *
 * @param config - The Trello config to build with.
 * @param statuses - The statuses to answer with, in order.
 * @returns The context and every captured request.
 */
function testTrello(config: TrelloConfig, statuses: number[] = [200]): TestTrello {
  const requests: Request[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    const status = statuses[Math.min(requests.length, statuses.length - 1)];
    requests.push(request);
    return new Response(status === 200 ? JSON.stringify({ id: 'member-id' }) : 'invalid token', { status });
  };

  const context = trelloFactory({ fetchHandler, logTrelloServerErrorFunction: () => undefined })(config).trelloContext;
  return { requests, context };
}

interface TestProvider {
  readonly provider: TrelloAccessTokenProvider;
  readonly calls: { provided: number; reset: number };
}

/**
 * A provider handing out `token-1`, `token-2`, … and counting calls and resets.
 *
 * @param expiresAt - The expiration each token reports.
 * @returns The provider and its counters.
 */
function testProvider(expiresAt?: () => Date): TestProvider {
  const calls = { provided: 0, reset: 0 };
  const provider = Object.assign(
    async () => {
      calls.provided += 1;
      return { accessToken: `token-${calls.provided}`, expiresAt: expiresAt?.() };
    },
    {
      resetAccessToken: async () => {
        calls.reset += 1;
      }
    }
  );

  return { provider, calls };
}

describe('trelloFactory()', () => {
  describe('key+token mode', () => {
    it('should send the legacy OAuth header unchanged to the legacy api url', async () => {
      const { requests, context } = testTrello({ apiKey: 'the-key', apiToken: 'the-token' });

      await getMe(context)();

      expect(requests[0].headers.get('authorization')).toBe('OAuth oauth_consumer_key="the-key", oauth_token="the-token"');
      expect(requests[0].url).toBe('https://api.trello.com/1/members/me');
    });
  });

  describe('static bearer mode', () => {
    it('should send the access token as a bearer token', async () => {
      const { requests, context } = testTrello({ accessToken: 'static-token' });

      await getMe(context)();

      expect(requests[0].headers.get('authorization')).toBe('Bearer static-token');
      expect(requests[0].url).toBe('https://api.trello.com/1/members/me');
    });

    it('should throw a 401 without retrying', async () => {
      const { requests, context } = testTrello({ accessToken: 'static-token' }, [401]);

      await expect(getMe(context)()).rejects.toBeInstanceOf(TrelloInvalidTokenError);
      expect(requests).toHaveLength(1);
    });

    it('should honor an apiUrl override', async () => {
      const { requests, context } = testTrello({ accessToken: 'static-token', apiUrl: 'https://trello.com/1' });

      await getMe(context)();

      expect(requests[0].url).toBe('https://trello.com/1/members/me');
    });
  });

  describe('provider bearer mode', () => {
    it('should cache the provided token until it nears expiry', async () => {
      const { provider, calls } = testProvider(() => new Date(Date.now() + 60 * 60 * 1000));
      const { requests, context } = testTrello({ accessTokenProvider: provider });

      await getMe(context)();
      await getMe(context)();

      expect(calls.provided).toBe(1);
      expect(requests[1].headers.get('authorization')).toBe('Bearer token-1');
    });

    it('should replace a token inside the expiration buffer', async () => {
      const { provider, calls } = testProvider(() => new Date(Date.now() + 30 * 1000));
      const { context } = testTrello({ accessTokenProvider: provider });

      await getMe(context)();
      await getMe(context)();

      // each token expires inside the default one-minute buffer, so each request asks again
      expect(calls.provided).toBe(2);
    });

    it('should reset and retry ONCE on a 401', async () => {
      const { provider, calls } = testProvider();
      const { requests, context } = testTrello({ accessTokenProvider: provider }, [401, 200]);

      const member = await getMe(context)();

      expect(member).toEqual({ id: 'member-id' });
      expect(calls.reset).toBe(1);
      expect(requests).toHaveLength(2);
      expect(requests[0].headers.get('authorization')).toBe('Bearer token-1');
      expect(requests[1].headers.get('authorization')).toBe('Bearer token-2');
    });

    it('should throw a second 401', async () => {
      const { provider, calls } = testProvider();
      const { requests, context } = testTrello({ accessTokenProvider: provider }, [401, 401]);

      await expect(getMe(context)()).rejects.toBeInstanceOf(TrelloInvalidTokenError);
      expect(calls.reset).toBe(1);
      expect(requests).toHaveLength(2);
    });
  });

  describe('listWebhooksForToken()', () => {
    it('should refuse a bearer context with no explicit token', () => {
      const { context } = testTrello({ accessToken: 'static-token' });
      expect(() => listWebhooksForToken(context)()).toThrow('POST /1/webhooks');
    });

    it('should use the configured token in key+token mode', async () => {
      const { requests, context } = testTrello({ apiKey: 'the-key', apiToken: 'the-token' });

      await listWebhooksForToken(context)();

      expect(requests[0].url).toBe('https://api.trello.com/1/tokens/the-token/webhooks');
    });
  });
});
