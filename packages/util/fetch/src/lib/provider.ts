import { fetchService, FetchService } from './fetch';
import fetch, { Request, RequestInfo, RequestInit } from 'node-fetch';

export const nodeFetchService: FetchService = fetchService({
  makeFetch: fetch as any,
  makeRequest: (x, y) => new Request(x as RequestInfo, y as RequestInit) as any
});
