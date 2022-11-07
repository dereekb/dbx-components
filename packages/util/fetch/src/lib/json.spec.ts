import { ServerError } from '@dereekb/util';
import { itShouldFail, expectFail, failDueToSuccess, failSuccessfully } from '@dereekb/util/test';
import { fetchService, fetchRequestFactory, FetchRequestFactory, FetchService } from './fetch';
import fetch, { Request, RequestInfo, RequestInit } from 'node-fetch';
import { FetchResponseError, requireOkResponse } from './error';
import { fetchJsonFunction } from './json';

const testFetch: FetchService = fetchService({
  makeFetch: fetch as any,
  makeRequest: (x, y) => new Request(x as RequestInfo, y as RequestInit) as any
});

describe('fetchJson()', () => {
  // Expected result: {"statusCode":403,"message":"Forbidden"}
  const forbiddenUrl = 'https://components.dereekb.com/api/webhook';

  const fetch = testFetch.makeFetch();
  const fetchJson = fetchJsonFunction(fetch);

  describe('GET', () => {
    const method = 'GET';

    it('should send a GET request and should parse the result as JSON.', async () => {
      // TODO: Switch to different resource later

      // NOTE: Fetch will not throw an error on non-ok results, allowing us to test against the webhook url.

      const response = await fetchJson<{ statusCode: number; message: 'Forbidden' }>(forbiddenUrl, method);
      expect(response.message).toBe('Forbidden');
    });

    it('should send a GET request when passing method in parameters and parse the result as JSON.', async () => {
      // TODO: Switch to different resource later

      const response = await fetchJson<{ statusCode: number; message: 'Forbidden' }>(forbiddenUrl, { method });
      expect(response.message).toBe('Forbidden');
    });
  });
});
