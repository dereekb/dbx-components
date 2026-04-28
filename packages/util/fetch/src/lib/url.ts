import { type ArrayOrValue, fixExtraQueryParameters, forEachInIterable, forEachKeyValue, isEmptyIterable, isIterable, type Maybe, useIterableOrValue } from '@dereekb/util';

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

/**
 * Resolves a FetchURLInput to a URL string. Handles plain strings, URL objects, and
 * FetchURLConfiguration objects by appending query parameters when provided.
 *
 * @param input - a string, URL, or FetchURLConfiguration to resolve
 * @returns the resolved URL as a string
 */
export function fetchURL(input: FetchURLInput): string {
  let url: string;

  if (typeof input === 'string') {
    url = input;
  } else if (isURL(input)) {
    url = input.href;
  } else {
    const baseUrl = fetchURL(input.url);

    if (input.queryParams) {
      const searchParams = queryParamsToSearchParams(input.queryParams);

      if (!isEmptyIterable(searchParams)) {
        url = fixExtraQueryParameters(baseUrl + `?${searchParams.toString()}`);
      } else {
        url = baseUrl;
      }
    } else {
      url = baseUrl;
    }
  }

  return url;
}

/**
 * Type guard that checks whether the given value is a URL instance.
 *
 * @param input - the value to test
 * @returns true if the input is a URL instance
 */
export function isURL(input: unknown): input is URL {
  return typeof input === 'object' && input instanceof URL;
}

/**
 * Type guard that checks whether the given value is a URLSearchParams instance.
 *
 * @param input - the value to test
 * @returns true if the input is a URLSearchParams instance
 */
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

    // ignore null/undefined keys and values
    if (key != null && values != null) {
      const keyString = String(key);
      useIterableOrValue(values, (value) => {
        // ignore null/undefined values
        if (value != null) {
          paramTuples.push([keyString, String(value)]);
        }
      });
    }
  });

  return paramTuples;
}

export type FetchURLQueryKeyValueTuple = [Maybe<FetchURLQueryKeyValueTupleKey>, Maybe<ArrayOrValue<Maybe<FetchURLQueryKeyValueTupleKeyValue>>>];
export type FetchURLQueryKeyValueTupleKey = string | number;
export type FetchURLQueryKeyValueTupleKeyValue = string | number | boolean;

/**
 * Converts a FetchURLQueryParamsInput value (URLSearchParams, string, iterable of tuples, or
 * params object) into a URLSearchParams instance.
 *
 * @param input - the query parameters input to convert
 * @returns a URLSearchParams instance representing the input
 */
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
export type FetchURLSearchParamsObject = Partial<Record<FetchURLQueryKeyValueTupleKey, Maybe<ArrayOrValue<FetchURLQueryKeyValueTupleKeyValue>>>>;

/**
 * Converts a FetchURLSearchParamsObject (a plain key-value record) into a URLSearchParams instance,
 * expanding array values into multiple entries for the same key and filtering out null/undefined values.
 *
 * @param input - the params object to convert
 * @returns a URLSearchParams instance representing the input object
 */
export function fetchURLSearchParamsObjectToURLSearchParams(input: FetchURLSearchParamsObject): URLSearchParams {
  const paramTuples: [string, string][] = [];

  forEachKeyValue(input, {
    forEach: (tuple) => {
      const [key, values] = tuple;

      const keyString = String(key);

      if (values != null) {
        useIterableOrValue(values, (x) => {
          paramTuples.push([keyString, String(x)]);
        });
      }
    }
  });

  return new URLSearchParams(paramTuples);
}
