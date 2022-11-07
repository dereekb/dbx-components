import { ArrayOrValue, forEachKeyValue, isIterable, useIterableOrValue } from '@dereekb/util';

export type SimpleFetchURLInput = URL | string;

export interface FetchURLConfiguration {
  /**
   * Base URL to use
   */
  url: SimpleFetchURLInput;
  /**
   * Query parameters to append to the url.
   */
  queryParams?: FetchURLQueryParamsInput;
}

export type FetchURLInput = SimpleFetchURLInput | FetchURLConfiguration;

export function fetchURL(input: FetchURLInput): URL {
  let url: URL;

  if (typeof input === 'string') {
    url = new URL(input);
  } else if (isURL(input)) {
    url = input;
  } else {
    const baseUrl = fetchURL(input.url);

    if (input.queryParams) {
      const searchParams = queryParamsToSearchParams(input.queryParams);
      url = new URL(`?${searchParams.toString()}`, baseUrl);
    } else {
      url = baseUrl;
    }
  }

  return url;
}

export function isURL(input: unknown): input is URL {
  return typeof input === 'object' && input instanceof URL;
}

export function isURLSearchParams(input: unknown): input is URLSearchParams {
  return typeof input === 'object' && input instanceof URLSearchParams;
}

export type FetchURLQueryParamsInput = URLSearchParams | FetchURLSearchParamsObject | Iterable<FetchURLQueryKeyValueTuple> | string;
export type FetchURLQueryKeyValueTuple = [string, string];

export function queryParamsToSearchParams(input: FetchURLQueryParamsInput): URLSearchParams {
  if (isURLSearchParams(input)) {
    // by url search params
    return input;
  } else if (isIterable(input) || typeof input === 'string') {
    // By tuples
    return new URLSearchParams(input as FetchURLQueryKeyValueTuple[] | string);
  } else {
    return fetchURLSearchParamsObjectToURLSearchParams(input);
  }
}

export type FetchURLSearchParamsObject = Record<string, ArrayOrValue<string>>;

export function fetchURLSearchParamsObjectToURLSearchParams(input: FetchURLSearchParamsObject): URLSearchParams {
  const paramTuples: [string, string][] = [];

  forEachKeyValue(input as Record<string, ArrayOrValue<string>>, {
    forEach: (tuple) => {
      const [key, values] = tuple;
      useIterableOrValue(values, (x) => paramTuples.push([key, x]));
    }
  });

  return new URLSearchParams(paramTuples);
}
