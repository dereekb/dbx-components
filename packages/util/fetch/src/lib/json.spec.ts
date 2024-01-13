import { type WebsiteDomain, type WebsitePath } from '@dereekb/util';
import { type FetchService } from './fetch';
import { fetchJsonFunction } from './json';
import { nodeFetchService } from './provider';

const testFetch: FetchService = nodeFetchService;

jest.setTimeout(30000);

describe('fetchJson()', () => {
  // Expected result: {"statusCode":403,"message":"Forbidden"}
  const forbiddenUrlBaseUrl: WebsiteDomain = 'https://components.dereekb.com/api';
  const forbiddernUrlRelativeUrl: WebsitePath = '/webhook';

  const forbiddenUrl = 'https://components.dereekb.com/api/webhook';

  const fetch = testFetch.makeFetch();
  const fetchJson = fetchJsonFunction(fetch);

  describe('fetch with base url', () => {
    const fetch = testFetch.makeFetch({
      baseUrl: forbiddenUrlBaseUrl
    });

    const fetchJson = fetchJsonFunction(fetch);

    it('should send a GET request by default.', async () => {
      // NOTE: Fetch will not throw an error on non-ok results, allowing us to test against the webhook url.
      const response = await fetchJson<{ statusCode: number; message: 'Forbidden' }>(forbiddernUrlRelativeUrl);
      expect(response.message).toBe('Forbidden');
    });
  });

  describe('GET', () => {
    const method = 'GET';

    it('should send a GET request by default.', async () => {
      // TODO: Switch to different resource later

      // NOTE: Fetch will not throw an error on non-ok results, allowing us to test against the webhook url.

      const response = await fetchJson<{ statusCode: number; message: 'Forbidden' }>(forbiddenUrl);
      expect(response.message).toBe('Forbidden');
    });

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
