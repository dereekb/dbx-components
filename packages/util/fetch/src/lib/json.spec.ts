import { repairJsonObjectOrUndefined, type WebsiteDomain, type WebsitePath } from '@dereekb/util';
import { type FetchService } from './fetch';
import { type ConfiguredFetch } from './fetch.type';
import { fetchJsonFunction, fetchJsonTextDecodeResponseFunction, JsonResponseParseError, readFetchJsonText, returnNullHandleFetchJsonParseErrorFunction } from './json';
import { fetchApiFetchService } from './provider';

const testFetch: FetchService = fetchApiFetchService;

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

  /*
  describe('fetch with intercept', () => {
    // TODO: test intercepting a json response
  });
  */

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

describe('offline', () => {
  function fakeFetch(body: BodyInit | null, init?: ResponseInit): ConfiguredFetch {
    return () => Promise.resolve(new Response(body, init));
  }

  describe('fetchJsonFunction()', () => {
    it('should parse a JSON body with the default decoder', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch('{"a":1}'));
      const result = await fetchJson<{ a: number }>('https://example.com/x');
      expect(result).toEqual({ a: 1 });
    });

    it('should reject with a JsonResponseParseError holding the Response when the body is not JSON', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch('<html>', { status: 200 }));
      let error: unknown;

      try {
        await fetchJson('https://example.com/x');
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(JsonResponseParseError);
      expect((error as JsonResponseParseError).response instanceof Response).toBe(true);
      expect((error as JsonResponseParseError).response.status).toBe(200);
    });

    it('should hand a custom parse-error handler the Response, not the decode error', async () => {
      const handler = vi.fn((_response: Response) => 'handled');
      const fetchJson = fetchJsonFunction(fakeFetch('<html>'), handler);
      const result = await fetchJson('https://example.com/x');

      expect(result).toBe('handled');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBeInstanceOf(Response);
    });

    it('should resolve null with returnNullHandleFetchJsonParseErrorFunction', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch('<html>'), returnNullHandleFetchJsonParseErrorFunction);
      const result = await fetchJson('https://example.com/x');
      expect(result).toBeNull();
    });

    it('should run interceptJsonResponse after a custom decodeResponse', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch('{"a":1}'), {
        decodeResponse: async (response) => ({ decoded: await response.text() }),
        interceptJsonResponse: (json) => ({ intercepted: json })
      });

      const result = await fetchJson('https://example.com/x');
      expect(result).toEqual({ intercepted: { decoded: '{"a":1}' } });
    });
  });

  describe('fetchJsonTextDecodeResponseFunction()', () => {
    it('should parse a JSON body', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch('{"a":1}'), { decodeResponse: fetchJsonTextDecodeResponseFunction() });
      const result = await fetchJson('https://example.com/x');
      expect(result).toEqual({ a: 1 });
    });

    it('should hand a non-JSON body to the parse-error handler', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch('<html>'), { decodeResponse: fetchJsonTextDecodeResponseFunction(), handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction });
      const result = await fetchJson('https://example.com/x');
      expect(result).toBeNull();
    });

    it('should hand an empty body to the parse-error handler', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch(''), { decodeResponse: fetchJsonTextDecodeResponseFunction(), handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction });
      const result = await fetchJson('https://example.com/x');
      expect(result).toBeNull();
    });

    it('should decode a repairable body when a repairing parseJson is passed', async () => {
      const fetchJson = fetchJsonFunction(fakeFetch('{"a":1,"b":[1,2,],}'), { decodeResponse: fetchJsonTextDecodeResponseFunction({ parseJson: (text) => repairJsonObjectOrUndefined(text) }) });
      const result = await fetchJson('https://example.com/x');
      expect(result).toEqual({ a: 1, b: [1, 2] });
    });
  });

  describe('readFetchJsonText()', () => {
    it('should read an ok JSON body', async () => {
      const result = await readFetchJsonText<{ a: number }>(fakeFetch('{"a":1}')('https://example.com/x'));
      expect(result.parsed).toBe(true);
      expect(result.json).toEqual({ a: 1 });
      expect(result.text).toBe('{"a":1}');
      expect(result.response.ok).toBe(true);
    });

    it('should resolve a non-ok JSON body without throwing', async () => {
      const result = await readFetchJsonText(fakeFetch('{"error":{"message":"denied"}}', { status: 403 })('https://example.com/x'));
      expect(result.response.ok).toBe(false);
      expect(result.response.status).toBe(403);
      expect(result.parsed).toBe(true);
      expect(result.json).toEqual({ error: { message: 'denied' } });
    });

    it('should return the raw text and parsed false for an HTML body', async () => {
      const result = await readFetchJsonText(fakeFetch('<html>')('https://example.com/x'));
      expect(result.parsed).toBe(false);
      expect(result.json).toBeUndefined();
      expect(result.text).toBe('<html>');
    });

    it('should report a JSON null body as parsed', async () => {
      const result = await readFetchJsonText(fakeFetch('null')('https://example.com/x'));
      expect(result.parsed).toBe(true);
      expect(result.json).toBeNull();
    });

    it('should report an empty body as not parsed', async () => {
      const result = await readFetchJsonText(fakeFetch('')('https://example.com/x'));
      expect(result.parsed).toBe(false);
      expect(result.text).toBe('');
    });

    it('should treat a throwing parseJson as not JSON', async () => {
      const result = await readFetchJsonText(fakeFetch('{"a":1}')('https://example.com/x'), {
        parseJson: () => {
          throw new Error('nope');
        }
      });

      expect(result.parsed).toBe(false);
      expect(result.json).toBeUndefined();
    });

    it('should reject with the same error when the request fails', async () => {
      const error = new TypeError('fetch failed');
      await expect(readFetchJsonText(Promise.reject(error))).rejects.toBe(error);
    });

    it('should reject when the body stream fails', async () => {
      const error = new Error('stream broke');
      const response = new Response(new ReadableStream({ start: (controller) => controller.error(error) }));
      await expect(readFetchJsonText(Promise.resolve(response))).rejects.toBeDefined();
    });
  });
});
