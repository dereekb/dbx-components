import { fetchService, type FetchService } from './fetch';

export const nodeFetchService: FetchService = fetchService({
  makeFetch: fetch as any,
  makeRequest: (x, y) => new Request(x as RequestInfo, y as RequestInit) as any
});
