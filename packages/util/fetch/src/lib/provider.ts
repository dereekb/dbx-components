import { fetchService, type FetchService } from './fetch';

/**
 * Default FetchService implementation that uses the native Fetch api.
 */
export const fetchApiFetchService: FetchService = fetchService({
  makeFetch: fetch as any,
  makeRequest: (x, y) => new Request(x as RequestInfo, y as RequestInit) as any
});

// MARK: Compat
/**
 * @deprecated use fetchApiFetchService instead. This is an alias.
 */
export const nodeFetchService: FetchService = fetchApiFetchService;
