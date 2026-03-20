import { fetchService, type FetchService } from './fetch';

/**
 * Default FetchService implementation that uses the native Fetch api.
 */
export const fetchApiFetchService: FetchService = fetchService({
  makeFetch: fetch as typeof fetch,
  makeRequest: (x, y) => new Request(x as RequestInfo, y as RequestInit) as unknown as Request
});
