import { ArrayOrValue, forEachInIterable, forEachKeyValue, isIterable, mapIterable, useIterableOrValue } from '@dereekb/util';

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

export type FetchURLQueryParamsInput = URLSearchParams | FetchURLSearchParamsObject | Iterable<FetchURLQueryKeyValueStringTuple> | Iterable<FetchURLQueryKeyValueTuple> | string;
export type FetchURLQueryKeyValueStringTuple = [string, string];

/**
 * Converts the input
 *
 * @param input
 * @returns
 */
export function fetchURLQueryKeyValueStringTuples(input: Iterable<FetchURLQueryKeyValueTuple>): FetchURLQueryKeyValueStringTuple[] {
  const paramTuples: [string, string][] = [];

  forEachInIterable(input, (tuple) => {
    const [key, values] = tuple;
    const keyString = String(key);
    useIterableOrValue(values, (value) => paramTuples.push([keyString, String(value)]));
  });

  return paramTuples;
}

export type FetchURLQueryKeyValueTuple = [FetchURLQueryKeyValueTupleKey, ArrayOrValue<FetchURLQueryKeyValueTupleKeyValue>];
export type FetchURLQueryKeyValueTupleKey = string | number;
export type FetchURLQueryKeyValueTupleKeyValue = string | number | boolean;

export function queryParamsToSearchParams(input: FetchURLQueryParamsInput): URLSearchParams {
  let result: URLSearchParams;

  if (isURLSearchParams(input)) {
    // by url search params
    result = input;
  } else if (typeof input === 'string') {
    result = new URLSearchParams(input);
  } else if (isIterable(input)) {
    // By tuples
    result = new URLSearchParams(fetchURLQueryKeyValueStringTuples(input));
  } else {
    result = fetchURLSearchParamsObjectToURLSearchParams(input);
  }

  return result;
}

export type FetchURLSearchTupleValueKey = string | number;
export type FetchURLSearchTupleValue = string | number;
export type FetchURLSearchParamsObject = Record<FetchURLQueryKeyValueTupleKey, ArrayOrValue<FetchURLQueryKeyValueTupleKeyValue>>;

export function fetchURLSearchParamsObjectToURLSearchParams(input: FetchURLSearchParamsObject): URLSearchParams {
  const paramTuples: [string, string][] = [];

  forEachKeyValue(input as FetchURLSearchParamsObject, {
    forEach: (tuple) => {
      const [key, values] = tuple;
      useIterableOrValue(values, (x) => paramTuples.push([String(key), String(x)]));
    }
  });

  return new URLSearchParams(paramTuples);
}
