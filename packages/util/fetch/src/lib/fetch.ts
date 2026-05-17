import { type Factory, fixMultiSlashesInSlashPath, type MapFunction, type Maybe, removeTrailingSlashes, type WebsitePath, type WebsiteUrl, multiValueMapBuilder, filterMaybeArrayValues, type PromiseOrValue, isPromiseLike, type GetterOrValue, asGetter, isWebsiteUrlWithPrefix } from '@dereekb/util';
import { FetchRequestFactoryError, fetchOk } from './error';
import { type ConfiguredFetchWithTimeout, type RequestInitWithTimeout, type RequestWithTimeout } from './fetch.type';
import { fetchTimeout } from './timeout';

/**
 * Interface used for creating fetch related resource factories.
 */
export interface FetchService {
  readonly makeFetch: (config?: ConfigureFetchInput) => ConfiguredFetchWithTimeout;
  readonly makeRequest: FetchRequestFactory;
  readonly fetchRequestFactory: typeof fetchRequestFactory;
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

  return {
    fetchRequestFactory: (config: FetchRequestFactoryInput) => fetchRequestFactory({ makeRequest, baseRequest, ...config }),
    makeFetch: (config: ConfigureFetchInput = {}) => configureFetch({ makeRequest, makeFetch: inputMakeFetch, baseRequest, ...config }),
    makeRequest: config.makeRequest
  };
}

// MARK: Make Fetch
export type MapFetchResponseFunction = MapFunction<Promise<Response>, Promise<Response>>;

/**
 * Custom fetch handler that takes in a Request and fetch function and returns a Response.
 */
export type FetchHandler = (request: Request, makeFetch: typeof fetch) => Promise<Response>;

export interface ConfigureFetchInput extends FetchRequestFactoryInput {
  readonly makeFetch?: typeof fetch;
  /**
   * Whether or not to add timeout handling using timeoutFetch().
   *
   * Default: false
   */
  readonly useTimeout?: boolean;
  /**
   * Whether or not to map the fetch response using requireOkResponse().
   *
   * Default: false
   */
  readonly requireOkResponse?: boolean;
  /**
   * (Optional) Custom fetch handler.
   */
  readonly fetchHandler?: FetchHandler;
  /**
   * (Optional) MapFetchResponseFunction
   *
   * If requireOkResponse is true, this mapping occurs afterwards.
   */
  readonly mapResponse?: MapFetchResponseFunction;
}

/**
 * Default FetchHabdler.
 *
 * @param request
 * @param makeFetch
 * @returns
 */
export const DEFAULT_FETCH_HANDLER: FetchHandler = (request, makeFetch) => makeFetch(request);

/**
 * Creates a function that wraps fetch and uses a FetchRequestFactory to generate a Request before invoking Fetch.
 *
 * @param config
 * @returns
 */
export function configureFetch(config: ConfigureFetchInput): ConfiguredFetchWithTimeout {
  const { makeFetch: inputMakeFetch = fetch, fetchHandler = DEFAULT_FETCH_HANDLER, useTimeout, requireOkResponse: inputRequireOkResponse, mapResponse } = config;
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

  return async (input: RequestInfo | URL, init?: Maybe<RequestInit>) => {
    const request = await makeFetchRequest(input, init);
    let response = fetchHandler(request, makeFetch);

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
  readonly makeRequest?: FetchRequestFactory;
  /**
   * Appends this URL to every fetch request.
   */
  readonly baseUrl?: WebsiteUrl;
  /**
   * Whether or not to append the base url to RequestInfo that is already configured, instead of only URL or strings.
   */
  readonly useBaseUrlForConfiguredFetchRequests?: boolean;
  /**
   * Whether or not to force always using the base url even when a WebsiteUrlWithPrefix value is provided.
   *
   * Defaults to useBaseUrlForConfiguredFetchRequests's value.
   */
  readonly forceBaseUrlForWebsiteUrlWithPrefix?: boolean;
  /**
   * Base request info to add to each value.
   */
  readonly baseRequest?: GetterOrValue<PromiseOrValue<RequestInit>>;
  /**
   * Default timeout to add to requestInit values.
   *
   * NOTE: This timeout is not used by this fetchRequest directly, but is added to the baseRequest.
   */
  readonly timeout?: number;
  /**
   * Maps the input RequestInit value to another.
   *
   * If baseRequest is provided, the values will already be appended before reaching this factory.
   */
  readonly requestInitFactory?: FetchRequestInitFactory;
}

export type FetchRequestInitFactory = (currRequest: PromiseOrValue<Request>, init?: PromiseOrValue<RequestInit>) => PromiseOrValue<Maybe<RequestInitWithTimeout>>;
export type FetchRequestFactory = (input: RequestInfo | URL, init?: Maybe<RequestInit>) => PromiseOrValue<Request>;
export type AbortControllerFactory = Factory<AbortController>;

/**
 * The deafult FetchRequestFactory implementation that uses window/global Request.
 *
 * @param input
 * @param init
 * @returns
 */
export const DEFAULT_FETCH_REQUEST_FACTORY: FetchRequestFactory = (input, init) => new Request(input, init ?? undefined);

/**
 * Creates a FetchRequestFactory that builds Request objects by applying base URL resolution,
 * base request init merging, timeout configuration, and custom request init transformations.
 *
 * @param config - Configuration for URL resolution, base request defaults, timeout, and request init transformations.
 * @returns A FetchRequestFactory that produces fully configured Request objects.
 */
export function fetchRequestFactory(config: FetchRequestFactoryInput): FetchRequestFactory {
  const { makeRequest = DEFAULT_FETCH_REQUEST_FACTORY, baseUrl: inputBaseUrl, baseRequest: inputBaseRequest, timeout, requestInitFactory, useBaseUrlForConfiguredFetchRequests = false, forceBaseUrlForWebsiteUrlWithPrefix = useBaseUrlForConfiguredFetchRequests } = config;

  const baseUrl = inputBaseUrl ? new URL(removeTrailingSlashes(inputBaseUrl)) : undefined;

  const buildUrl = baseUrl
    ? (url: string | WebsitePath | URL) => {
        let result: URL;
        const urlString = url.toString();

        // retain the origin and any pathname from the base url, unless the url contains a prefix
        if (!forceBaseUrlForWebsiteUrlWithPrefix && isWebsiteUrlWithPrefix(urlString)) {
          result = new URL(urlString);
        } else {
          const urlPath = baseUrl.origin + fixMultiSlashesInSlashPath('/' + baseUrl.pathname + '/' + url);
          result = new URL(urlPath, baseUrl);
        }

        return result;
      }
    : undefined;

  async function asFetchRequest(input: PromiseOrValue<RequestInfo | URL>): Promise<Request> {
    const awaitedInput: RequestInfo | URL = isPromiseLike(input) ? await input : input;

    return isFetchRequest(awaitedInput) ? awaitedInput : makeRequest(awaitedInput);
  }

  const buildRequestWithFixedUrl = buildUrl
    ? async (input: RequestInfo | URL) => {
        let relativeUrl: Maybe<string>;
        let baseRequest: Maybe<Request>;
        let request: Maybe<Request>;

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
          request = await makeRequest(input);
        }

        if (!request) {
          const url = buildUrl(relativeUrl as string);
          request = await makeRequest(url.href, baseRequest);
        }

        return request;
      }
    : asFetchRequest;

  let buildRequestInit: FetchRequestInitFactory;

  if (inputBaseRequest != null || timeout != null) {
    const inputBaseRequestAsGetter = asGetter(inputBaseRequest);

    async function computeBaseRequest() {
      const computedBaseRequest = await inputBaseRequestAsGetter();
      return (timeout ? { ...computedBaseRequest, timeout } : computedBaseRequest) as RequestInitWithTimeout;
    }

    async function combineRequestInits(request: PromiseOrValue<Request>, requestInit: PromiseOrValue<Maybe<RequestInit>>) {
      const baseRequest = await computeBaseRequest();
      const merged: RequestInit = mergeRequestInits(baseRequest, await requestInit) as RequestInitWithTimeout;
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

  return async (input: RequestInfo | URL, init?: Maybe<RequestInit>) => {
    try {
      const fixedRequest = await buildRequestWithFixedUrl(input);
      init = await buildRequestInit(fixedRequest, init ?? undefined);
      const request = await makeRequest(fixedRequest, init);

      (request as RequestWithTimeout).timeout = timeout; // copy/set timeout on the request directly
      return request;
    } catch (e) {
      if (e instanceof FetchRequestFactoryError) {
        throw e;
      } else {
        throw new FetchRequestFactoryError(e);
      }
    }
  };
}

/**
 * Merges two RequestInit objects, combining their headers and spreading remaining properties
 * so that values from the second init override the base.
 *
 * @param base - The base RequestInit to merge onto.
 * @param requestInit - Optional RequestInit whose values override the base.
 * @returns The merged RequestInit.
 */
export function mergeRequestInits<T extends RequestInit>(base: T, requestInit?: Maybe<T>): T {
  let result: T;

  if (requestInit) {
    const headers: [string, string][] = mergeRequestHeaders([base.headers, requestInit.headers]);
    result = { ...base, ...requestInit, headers };
  } else {
    result = base;
  }

  return result;
}

/**
 * Merges an array of HeadersInit values into a single array of key-value tuples.
 * Later headers override earlier ones on a per-key basis while preserving multi-value support.
 *
 * @param inputHeadersArray - Header sources to combine; later entries override earlier ones per header name.
 * @returns Combined [key, value] tuples representing the merged headers in iteration order.
 */
export function mergeRequestHeaders(inputHeadersArray: Maybe<HeadersInit>[]): [string, string][] {
  const headersMap = multiValueMapBuilder<string, string>();

  filterMaybeArrayValues(inputHeadersArray).forEach((headers) => {
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

/**
 * Converts a HeadersInit value (tuple array, Headers object, or plain object) into
 * a normalized array of [key, value] tuples.
 *
 * @param headers - Header input in any supported shape to normalize.
 * @returns Tuple list usable as input to multi-value header merging.
 */
export function headersToHeadersTuple(headers: HeadersInit): [string, string][] {
  let tuples: [string, string][] = [];

  if (Array.isArray(headers)) {
    // use as tuples
    tuples = headers;
  } else if (typeof headers.forEach === 'function') {
    // use as a headers object
    headers.forEach((value, key) => {
      tuples.push([key, value]);
    });
  } else if (typeof headers === 'object') {
    // use as a normal object
    tuples = Object.entries(headers as Record<string, string>);
  }

  return tuples;
}

/**
 * Type guard that checks whether the given input is a fetch Request object
 * by testing for the presence of a url property.
 *
 * @param input - The value to test.
 * @returns True if the input is a Request.
 */
export function isFetchRequest(input: unknown): input is Request {
  return Boolean((input as Request).url);
}
