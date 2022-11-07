import { Factory, MapFunction, Maybe, removeTrailingFileTypeSeparators, WebsitePath, WebsiteUrl } from '@dereekb/util';
import { fetchOk, requireOkResponse } from './error';
import { ConfiguredFetchWithTimeout, RequestInitWithTimeout, RequestWithTimeout } from './fetch.type';
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
  const baseUrl = inputBaseUrl ? new URL(removeTrailingFileTypeSeparators(inputBaseUrl)) : undefined;
  const baseRequest = timeout ? { ...inputBaseRequest, timeout } : inputBaseRequest;

  const buildUrl = baseUrl
    ? (url: string | WebsitePath | URL) => {
        return new URL(url, baseUrl);
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

  if (baseRequest && requestInitFactory) {
    buildRequestInit = (req, x) => requestInitFactory(req, { ...baseRequest, timeout: (req as RequestWithTimeout).timeout, ...x } as RequestInitWithTimeout);
  } else if (baseRequest) {
    buildRequestInit = (req, x) => ({ ...baseRequest, timeout: (req as RequestWithTimeout).timeout, ...x });
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

export function isFetchRequest(input: unknown): input is Request {
  return Boolean((input as Request).url);
}
