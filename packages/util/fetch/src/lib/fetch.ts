import { Maybe, removeTrailingFileTypeSeparators, WebsitePath, WebsiteUrl } from '@dereekb/util';

/**
 * Interface used for creating fetch related resource factories.
 */
export interface FetchService {
  makeFetch: typeof configureFetch;
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
    makeFetch: (config: ConfigureFetchInput) => configureFetch({ makeFetch: inputMakeFetch, ...config }),
    fetchRequestFactory: (config: FetchRequestFactoryInput) => fetchRequestFactory({ makeRequest, ...config }),
    makeRequest: config.makeRequest
  };

  return factory;
}

// MARK: Make Fetch
export interface ConfigureFetchInput extends FetchRequestFactoryInput {
  makeFetch?: typeof fetch;
}

export type ConfiguredFetch = typeof fetch;

/**
 * Creates a function that wraps fetch and uses a FetchRequestFactory to generate a Request before invoking Fetch.
 *
 * @param config
 * @returns
 */
export function configureFetch(config: ConfigureFetchInput): ConfiguredFetch {
  const { makeFetch = fetch } = config;
  const makeFetchRequest = fetchRequestFactory(config);

  return (input: RequestInfo | URL, init?: RequestInit | undefined) => {
    return makeFetch(makeFetchRequest(input, init));
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
  const { makeRequest: requestFactory = (input, init) => new Request(input, init), baseUrl: inputBaseUrl, baseRequest, requestInitFactory, useBaseUrlForConfiguredFetchRequests = false } = config;
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
      return new Request(input);
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
          request = requestFactory(input);
        }

        if (!request) {
          const url = buildUrl(relativeUrl as string);
          request = requestFactory(url.href, baseRequest);
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
    return requestFactory(fixedRequest, init);
  };
}

export function isFetchRequest(input: unknown): input is Request {
  return Boolean((input as Request).url);
}
