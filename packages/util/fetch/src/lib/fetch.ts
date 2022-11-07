import { MapFunction, Maybe, removeTrailingFileTypeSeparators, WebsitePath, WebsiteUrl } from '@dereekb/util';
import { requireOkResponse } from './error';

export type FetchMethod = Request['method'];

/**
 * Interface used for creating fetch related resource factories.
 */
export interface FetchService {
  makeFetch: (config?: ConfigureFetchInput) => ConfiguredFetch;
  makeRequest: FetchRequestFactory;
  fetchRequestFactory: typeof fetchRequestFactory;
}

/**
 * fetchService() configuration.
 */
export type FetchServiceConfig = Required<Pick<ConfigureFetchInput, 'makeFetch' | 'makeRequest'>>;

/**
 * Used to create a FetchService.
 *
 * @param config
 * @returns
 */
export function fetchService(config: FetchServiceConfig): FetchService {
  const { makeFetch: inputMakeFetch, makeRequest } = config;

  const factory = {
    fetchRequestFactory: (config: FetchRequestFactoryInput) => fetchRequestFactory({ makeRequest, ...config }),
    makeFetch: (config: ConfigureFetchInput = {}) => configureFetch({ makeRequest, makeFetch: inputMakeFetch, ...config }),
    makeRequest: config.makeRequest
  };

  return factory;
}

// MARK: Make Fetch
export type MapFetchResponseFunction = MapFunction<Promise<Response>, Promise<Response>>;

export interface ConfigureFetchInput extends FetchRequestFactoryInput {
  makeFetch?: typeof fetch;
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

export type ConfiguredFetch = typeof fetch;

/**
 * Creates a function that wraps fetch and uses a FetchRequestFactory to generate a Request before invoking Fetch.
 *
 * @param config
 * @returns
 */
export function configureFetch(config: ConfigureFetchInput): ConfiguredFetch {
  const { makeFetch = fetch, requireOkResponse: inputRequireOkResponse, mapResponse } = config;
  const makeFetchRequest = fetchRequestFactory(config);

  return (input: RequestInfo | URL, init?: RequestInit | undefined) => {
    let response = makeFetch(makeFetchRequest(input, init));

    if (inputRequireOkResponse) {
      response = requireOkResponse(response);
    }

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
   * Maps the input RequestInit value to another.
   *
   * If baseRequest is provided, the values will already be appended before reaching this factory.
   */
  requestInitFactory?: FetchRequestInitFactory;
}

export type FetchRequestInitFactory = (currRequest: Request, init?: RequestInit) => RequestInit | undefined;

export type FetchRequestFactory = (input: RequestInfo | URL, init?: RequestInit | undefined) => Request;

export function fetchRequestFactory(config: FetchRequestFactoryInput): FetchRequestFactory {
  const { makeRequest = (input, init) => new Request(input, init), baseUrl: inputBaseUrl, baseRequest, requestInitFactory, useBaseUrlForConfiguredFetchRequests = false } = config;

  console.log({ makeRequest, config });

  const baseUrl = inputBaseUrl ? new URL(removeTrailingFileTypeSeparators(inputBaseUrl)) : undefined;

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
    buildRequestInit = (req, x) => requestInitFactory(req, { ...baseRequest, ...x });
  } else if (baseRequest) {
    buildRequestInit = (_, x) => ({ ...baseRequest, ...x });
  } else if (requestInitFactory) {
    buildRequestInit = requestInitFactory;
  } else {
    buildRequestInit = (_, x) => x;
  }

  return (input: RequestInfo | URL, init?: RequestInit | undefined) => {
    const fixedRequest = buildRequestWithFixedUrl(input);
    init = buildRequestInit(fixedRequest, init);
    return makeRequest(fixedRequest, init);
  };
}

export function isFetchRequest(input: unknown): input is Request {
  return Boolean((input as Request).url);
}
