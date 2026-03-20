import { type PromiseRateLimiter } from '@dereekb/util';
import { type FetchResponseError } from './error';
import { rateLimitedFetchHandler, type RateLimitedFetchHandlerConfig } from './fetch.limit';

function mockRateLimiter(): PromiseRateLimiter {
  return {
    getNextWaitTime: () => 0,
    waitForRateLimit: () => Promise.resolve()
  };
}

function mockResponse(status: number, statusText = 'OK'): Response {
  return new Response(null, { status, statusText });
}

describe('rateLimitedFetchHandler()', () => {
  describe('basic usage', () => {
    it('should return a function with the _rateLimiter property', () => {
      const rateLimiter = mockRateLimiter();

      const handler = rateLimitedFetchHandler({
        rateLimiter,
        updateWithResponse: () => false
      });

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
      expect(handler._rateLimiter).toBe(rateLimiter);
    });

    it('should pass the request through to makeFetch and return the response', async () => {
      const expectedResponse = mockResponse(200);
      const rateLimiter = mockRateLimiter();

      const handler = rateLimitedFetchHandler({
        rateLimiter,
        updateWithResponse: () => false
      });

      const request = new Request('https://example.com/test');
      const makeFetch = vi.fn().mockResolvedValue(expectedResponse);

      const result = await handler(request, makeFetch);

      expect(result).toBe(expectedResponse);
      expect(makeFetch).toHaveBeenCalledTimes(1);
    });

    it('should wait for the rate limiter before making the fetch', async () => {
      const callOrder: string[] = [];
      const rateLimiter: PromiseRateLimiter = {
        getNextWaitTime: () => 0,
        waitForRateLimit: async () => {
          callOrder.push('waitForRateLimit');
        }
      };

      const handler = rateLimitedFetchHandler({
        rateLimiter,
        updateWithResponse: () => false
      });

      const request = new Request('https://example.com/test');
      const makeFetch = vi.fn().mockImplementation(async () => {
        callOrder.push('makeFetch');
        return mockResponse(200);
      });

      await handler(request, makeFetch);

      expect(callOrder).toEqual(['waitForRateLimit', 'makeFetch']);
    });

    it('should call updateWithResponse with the response', async () => {
      const expectedResponse = mockResponse(200);
      const updateWithResponse = vi.fn().mockReturnValue(false);

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse
      });

      const request = new Request('https://example.com/test');
      const makeFetch = vi.fn().mockResolvedValue(expectedResponse);

      await handler(request, makeFetch);

      expect(updateWithResponse).toHaveBeenCalledTimes(1);
      expect(updateWithResponse).toHaveBeenCalledWith(expectedResponse, undefined);
    });
  });

  describe('rate limiting retry behavior', () => {
    it('should retry once when updateWithResponse returns true and maxRetries is default (1)', async () => {
      const throttledResponse = mockResponse(429, 'Too Many Requests');
      const successResponse = mockResponse(200);

      let callCount = 0;
      const makeFetch = vi.fn().mockImplementation(async () => {
        callCount += 1;
        return callCount === 1 ? throttledResponse : successResponse;
      });

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse: (response) => response.status === 429
      });

      const request = new Request('https://example.com/test');
      const result = await handler(request, makeFetch);

      expect(result).toBe(successResponse);
      expect(makeFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry more than maxRetries times', async () => {
      const throttledResponse = mockResponse(429, 'Too Many Requests');

      const makeFetch = vi.fn().mockResolvedValue(throttledResponse);

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        maxRetries: 2,
        updateWithResponse: () => true
      });

      const request = new Request('https://example.com/test');
      const result = await handler(request, makeFetch);

      // initial call + 2 retries = 3 total calls
      expect(makeFetch).toHaveBeenCalledTimes(3);
      expect(result).toBe(throttledResponse);
    });

    it('should not retry when updateWithResponse returns false', async () => {
      const response = mockResponse(200);

      const makeFetch = vi.fn().mockResolvedValue(response);

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse: () => false
      });

      const request = new Request('https://example.com/test');
      const result = await handler(request, makeFetch);

      expect(makeFetch).toHaveBeenCalledTimes(1);
      expect(result).toBe(response);
    });

    it('should wait for rate limiter on each retry', async () => {
      let waitCount = 0;
      const rateLimiter: PromiseRateLimiter = {
        getNextWaitTime: () => 0,
        waitForRateLimit: async () => {
          waitCount += 1;
        }
      };

      const throttledResponse = mockResponse(429, 'Too Many Requests');
      const successResponse = mockResponse(200);
      let fetchCount = 0;

      const makeFetch = vi.fn().mockImplementation(async () => {
        fetchCount += 1;
        return fetchCount === 1 ? throttledResponse : successResponse;
      });

      const handler = rateLimitedFetchHandler({
        rateLimiter,
        updateWithResponse: (response) => response.status === 429
      });

      const request = new Request('https://example.com/test');
      await handler(request, makeFetch);

      // waitForRateLimit should be called for initial attempt and retry
      expect(waitCount).toBe(2);
    });

    it('should support maxRetries of 0, meaning no retries', async () => {
      const throttledResponse = mockResponse(429, 'Too Many Requests');

      const makeFetch = vi.fn().mockResolvedValue(throttledResponse);

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        maxRetries: 0,
        updateWithResponse: () => true
      });

      const request = new Request('https://example.com/test');
      const result = await handler(request, makeFetch);

      expect(makeFetch).toHaveBeenCalledTimes(1);
      expect(result).toBe(throttledResponse);
    });
  });

  describe('updateWithResponse', () => {
    it('should support async updateWithResponse that returns a promise', async () => {
      const throttledResponse = mockResponse(429, 'Too Many Requests');
      const successResponse = mockResponse(200);
      let fetchCount = 0;

      const makeFetch = vi.fn().mockImplementation(async () => {
        fetchCount += 1;
        return fetchCount === 1 ? throttledResponse : successResponse;
      });

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse: async (response) => {
          // simulate async check
          return response.status === 429;
        }
      });

      const request = new Request('https://example.com/test');
      const result = await handler(request, makeFetch);

      expect(result).toBe(successResponse);
      expect(makeFetch).toHaveBeenCalledTimes(2);
    });

    it('should pass the FetchResponseError to updateWithResponse when fetch throws', async () => {
      const errorResponse = mockResponse(500, 'Internal Server Error');
      const fetchResponseError = Object.assign(new Error('fetch error'), { response: errorResponse }) as unknown as FetchResponseError;

      const updateWithResponse = vi.fn().mockReturnValue(false);

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse
      });

      const request = new Request('https://example.com/test');
      const makeFetch = vi.fn().mockRejectedValue(fetchResponseError);

      try {
        await handler(request, makeFetch);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBe(fetchResponseError);
      }

      expect(updateWithResponse).toHaveBeenCalledWith(errorResponse, fetchResponseError);
    });

    it('should retry on FetchResponseError when updateWithResponse returns true', async () => {
      const errorResponse = mockResponse(429, 'Too Many Requests');
      const fetchResponseError = Object.assign(new Error('rate limited'), { response: errorResponse }) as unknown as FetchResponseError;
      const successResponse = mockResponse(200);

      let fetchCount = 0;
      const makeFetch = vi.fn().mockImplementation(async () => {
        fetchCount += 1;
        if (fetchCount === 1) {
          throw fetchResponseError;
        }
        return successResponse;
      });

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse: (_response, error) => error != null
      });

      const request = new Request('https://example.com/test');
      const result = await handler(request, makeFetch);

      expect(result).toBe(successResponse);
      expect(makeFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should re-throw FetchResponseError when retries are exhausted', async () => {
      const errorResponse = mockResponse(429, 'Too Many Requests');
      const fetchResponseError = Object.assign(new Error('rate limited'), { response: errorResponse }) as unknown as FetchResponseError;

      const makeFetch = vi.fn().mockRejectedValue(fetchResponseError);

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        maxRetries: 1,
        updateWithResponse: () => true
      });

      const request = new Request('https://example.com/test');

      try {
        await handler(request, makeFetch);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBe(fetchResponseError);
      }

      // initial + 1 retry = 2
      expect(makeFetch).toHaveBeenCalledTimes(2);
    });

    it('should re-throw FetchResponseError immediately when updateWithResponse returns false', async () => {
      const errorResponse = mockResponse(500, 'Internal Server Error');
      const fetchResponseError = Object.assign(new Error('server error'), { response: errorResponse }) as unknown as FetchResponseError;

      const makeFetch = vi.fn().mockRejectedValue(fetchResponseError);

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse: () => false
      });

      const request = new Request('https://example.com/test');

      try {
        await handler(request, makeFetch);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBe(fetchResponseError);
      }

      expect(makeFetch).toHaveBeenCalledTimes(1);
    });

    it('should clone the request for each fetch call', async () => {
      const throttledResponse = mockResponse(429, 'Too Many Requests');
      const successResponse = mockResponse(200);
      let fetchCount = 0;

      const clonedRequests: Request[] = [];
      const makeFetch = vi.fn().mockImplementation(async (req: Request) => {
        clonedRequests.push(req);
        fetchCount += 1;
        return fetchCount === 1 ? throttledResponse : successResponse;
      });

      const handler = rateLimitedFetchHandler({
        rateLimiter: mockRateLimiter(),
        updateWithResponse: (response) => response.status === 429
      });

      const request = new Request('https://example.com/test');
      await handler(request, makeFetch);

      expect(clonedRequests.length).toBe(2);
      // Each call should receive a cloned request (not the original)
      expect(clonedRequests[0]).not.toBe(request);
      expect(clonedRequests[1]).not.toBe(request);
      // But they should have the same URL
      expect(clonedRequests[0].url).toBe(request.url);
      expect(clonedRequests[1].url).toBe(request.url);
    });
  });
});
