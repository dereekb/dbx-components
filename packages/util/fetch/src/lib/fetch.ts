import { type Factory, fixMultiSlashesInSlashPath, type MapFunction, type Maybe, removeTrailingSlashes, type WebsitePath, type WebsiteUrl, multiValueMapBuilder, filterMaybeValues, objectToTuples } from '@dereekb/util';
import { fetchOk } from './error';
import { type ConfiguredFetchWithTimeout, type RequestInitWithTimeout, type RequestWithTimeout } from './fetch.type';
import { fetchTimeout } from './timeout';

/**
 * Interface used for creating fetch related resource factories.
 */
export interface FetchService {
  makeFetch: (config?: ConfigureFetchInput) => ConfiguredFetchWithTimeout;
  makeRequest: FetchRequestFactory;
  fetchRequestFactory: typeof fetchRequestFactory;
}

/**
 * fetchService() configuration.
 */
export type FetchServiceConfig = Required<Pick<ConfigureFetchInput, 'makeFetch' | 'makeRequest'>> & Pick<ConfigureFetchInput, 'baseRequest'>;

/**
 * Used to create a FetchService.
 *
 * @param config
 * @returns
 */
export function fetchService(config: FetchServiceConfig): FetchService {
  const { makeFetch: inputMakeFetch, makeRequest, baseRequest } = config;

  const factory = {
    fetchRequestFactory: (config: FetchRequestFactoryInput) => fetchRequestFactory({ makeRequest, baseRequest, ...config }),
    makeFetch: (config: ConfigureFetchInput = {}) => configureFetch({ makeRequest, makeFetch: inputMakeFetch, baseRequest, ...config }),
    makeRequest: config.makeRequest
  };

  return factory;
}

// MARK: Make Fetch
export type MapFetchResponseFunction = MapFunction<Promise<Response>, Promise<Response>>;

export interface ConfigureFetchInput extends FetchRequestFactoryInput {
  makeFetch?: typeof fetch;
  /**
   * Whether or not to add timeout handling using timeoutFetch().
   *
   * Default: false
   */
  useTimeout?: boolean;
  /**
   * Whether or not to map the fetch response using requireOkResponse().
   *
   * Default: false
   */
  requireOkResponse?: boolean;
  /**
   * (Optional) MapFetchResponseFunction
   *
   * If requireOkResponse is true, this mapping occurs afterwards.
   */
  mapResponse?: MapFetchResponseFunction;
}

/**
 * Creates a function that wraps fetch and uses a FetchRequestFactory to generate a Request before invoking Fetch.
 *
 * @param config
 * @returns
 */
export function configureFetch(config: ConfigureFetchInput): ConfiguredFetchWithTimeout {
  const { makeFetch: inputMakeFetch = fetch, useTimeout, requireOkResponse: inputRequireOkResponse, mapResponse } = config;
  let makeFetch = inputMakeFetch;

  if (useTimeout) {
    // add fetchTimeout
    makeFetch = fetchTimeout(makeFetch);
  }

  if (inputRequireOkResponse) {
    // Add fetchOk
    makeFetch = fetchOk(makeFetch);
  }

  const makeFetchRequest = fetchRequestFactory(config);

  return (input: RequestInfo | URL, init?: RequestInit | undefined) => {
    let response = makeFetch(makeFetchRequest(input, init));

    if (mapResponse) {
      response = mapResponse(response);
    }

    return response;
  };
}

// MARK: Request
export interface FetchRequestFactoryInput {
  /**
   * Request factory to use. If not defined, will default to window/global.
   */
  makeRequest?: FetchRequestFactory;
  /**
   * Appends this URL to every fetch request.
   */
  baseUrl?: WebsiteUrl;
  /**
   * Whether or not to append the base url to RequestInfo that is already configured, instead of only URL or strings.
   */
  useBaseUrlForConfiguredFetchRequests?: boolean;
  /**
   * Base request info to add to each value.
   */
  baseRequest?: RequestInit;
  /**
   * Default timeout to add to requestInit values.
   *
   * NOTE: This timeout is not used by this fetchRequest directly, but instead
   */
  timeout?: number;
  /**
   * Maps the input RequestInit value to another.
   *
   * If baseRequest is provided, the values will already be appended before reaching this factory.
   */
  requestInitFactory?: FetchRequestInitFactory;
}

export type FetchRequestInitFactory = (currRequest: Request, init?: RequestInit) => RequestInitWithTimeout | undefined;

export type FetchRequestFactory = (input: RequestInfo | URL, init?: RequestInit | undefined) => Request;
export type AbortControllerFactory = Factory<AbortController>;

export function fetchRequestFactory(config: FetchRequestFactoryInput): FetchRequestFactory {
  const { makeRequest = (input, init) => new Request(input, init), baseUrl: inputBaseUrl, baseRequest: inputBaseRequest, timeout, requestInitFactory, useBaseUrlForConfiguredFetchRequests = false } = config;
  const baseUrl = inputBaseUrl ? new URL(removeTrailingSlashes(inputBaseUrl)) : undefined;
  const baseRequest = (timeout ? { ...inputBaseRequest, timeout } : inputBaseRequest) as RequestInitWithTimeout;

  const buildUrl = baseUrl
    ? (url: string | WebsitePath | URL) => {
        // retain the origin and any pathname from the base url
        const urlPath = baseUrl.origin + fixMultiSlashesInSlashPath('/' + baseUrl.pathname + '/' + url);
        const result = new URL(urlPath, baseUrl);
        return result;
      }
    : undefined;

  function asFetchRequest(input: RequestInfo | URL): Request {
    if (isFetchRequest(input)) {
      return input;
    } else {
      return makeRequest(input);
    }
  }

  const buildRequestWithFixedUrl = buildUrl
    ? (input: RequestInfo | URL) => {
        let relativeUrl: Maybe<string>;
        let baseRequest: Request | undefined;
        let request: Request | undefined;

        if (typeof input === 'string') {
          relativeUrl = input;
        } else if (isFetchRequest(input)) {
          if (useBaseUrlForConfiguredFetchRequests) {
            relativeUrl = input.url; // copy the url, and use it as the base.
            baseRequest = input;
          } else {
            request = input;
          }
        } else {
          request = makeRequest(input);
        }

        if (!request) {
          const url = buildUrl(relativeUrl as string);
          request = makeRequest(url.href, baseRequest);
        }

        return request;
      }
    : asFetchRequest;

  let buildRequestInit: FetchRequestInitFactory;

  if (baseRequest) {
    function combineRequestInits(request: Request, requestInit: RequestInit | undefined) {
      const merged: RequestInit = mergeRequestInits(baseRequest, requestInit) as RequestInitWithTimeout;
      const timeout = (merged as RequestInitWithTimeout).timeout === undefined ? (request as RequestWithTimeout).timeout : (merged as RequestInitWithTimeout).timeout;

      return { ...merged, timeout } as RequestInitWithTimeout;
    }
    if (requestInitFactory) {
      buildRequestInit = (req, x) => requestInitFactory(req, combineRequestInits(req, x));
    } else {
      buildRequestInit = (req, x) => combineRequestInits(req, x);
    }
  } else if (requestInitFactory) {
    buildRequestInit = requestInitFactory;
  } else {
    buildRequestInit = (_, x) => x;
  }

  return (input: RequestInfo | URL, init?: RequestInit | undefined) => {
    const fixedRequest = buildRequestWithFixedUrl(input);
    init = buildRequestInit(fixedRequest, init);

    const request = makeRequest(fixedRequest, init);
    (request as RequestWithTimeout).timeout = timeout; // copy/set timeout on the request directly
    return request;
  };
}

export function mergeRequestInits<T extends RequestInit>(base: T, requestInit?: T | undefined): T {
  if (requestInit) {
    const headers: [string, string][] = mergeRequestHeaders([base.headers, requestInit?.headers]);
    return { ...base, ...requestInit, headers };
  } else {
    return base;
  }
}

export function mergeRequestHeaders(inputHeadersArray: Maybe<HeadersInit>[]): [string, string][] {
  const headersMap = multiValueMapBuilder<string, string>();

  filterMaybeValues(inputHeadersArray).forEach((headers, i) => {
    const tuples: [string, string][] = headersToHeadersTuple(headers);
    const visitedKeysSet = new Set();

    tuples.forEach(([key, value]) => {
      if (!visitedKeysSet.has(key)) {
        headersMap.delete(key); // delete all existing values to "override" them
        visitedKeysSet.add(key);
      }

      if (value) {
        headersMap.add(key, value);
      }
    });
  });

  return headersMap.tuples() as [string, string][];
}

export function headersToHeadersTuple(headers: HeadersInit): [string, string][] {
  let tuples: [string, string][] = [];

  if (Array.isArray(headers)) {
    // use as tuples
    tuples = headers as [string, string][];
  } else if (typeof headers.forEach === 'function') {
    // use as a headers object
    headers.forEach((value, key) => {
      tuples.push([key, value]);
    });
  } else if (typeof headers === 'object') {
    // use as a normal object
    tuples = objectToTuples(headers as Record<string, string>);
  }

  return tuples;
}

export function isFetchRequest(input: unknown): input is Request {
  return Boolean((input as Request).url);
}
