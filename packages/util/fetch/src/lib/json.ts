import { mapIdentityFunction, type MapSameFunction } from '@dereekb/util';
import { type FetchMethod, type ConfiguredFetch } from './fetch.type';
import { fetchURL, type FetchURLInput } from './url';

export type FetchJsonBody = string | object;

export class JsonResponseParseError extends Error {
  constructor(readonly response: Response) {
    super('Failed to parse the JSON body.');
  }
}

/**
 * Converts the input to a JSON string, or undefined if not provided.
 *
 * @param body
 * @returns
 */
export function fetchJsonBodyString(body: FetchJsonBody | undefined): string | undefined {
  return body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
}

export interface FetchJsonInput extends Omit<RequestInit, 'body'> {
  readonly method: FetchMethod;
  readonly body?: FetchJsonBody | undefined;
  /**
   * Optional intercept function to intercept/transform the response.
   *
   * Does not override any other configured interceptor and occurs after those configured interceptors.
   */
  readonly interceptResponse?: FetchJsonInterceptJsonResponseFunction;
}

export type FetchJsonInputMapFunction = MapSameFunction<FetchJsonInput>;

export type FetchJsonGetFunction = <R>(url: FetchURLInput) => Promise<R>;
export type FetchJsonMethodAndBodyFunction = <R>(url: FetchURLInput, method: string, body?: FetchJsonBody) => Promise<R>;
export type FetchJsonWithInputFunction = <R>(url: FetchURLInput, input: FetchJsonInput) => Promise<R>;

/**
 * Used to fetch from the input url and retrieve a JSON response.
 */
export type FetchJsonFunction = FetchJsonGetFunction & FetchJsonMethodAndBodyFunction & FetchJsonWithInputFunction;

export type FetchJsonInterceptJsonResponseFunction = (json: unknown, response: Response) => unknown;

export type HandleFetchJsonParseErrorFunction = (response: Response) => string | null | never;

export const throwJsonResponseParseErrorFunction: HandleFetchJsonParseErrorFunction = (response: Response) => {
  throw new JsonResponseParseError(response);
};

export const returnNullHandleFetchJsonParseErrorFunction: HandleFetchJsonParseErrorFunction = (_response: Response) => null;

export interface FetchJsonFunctionConfig extends FetchJsonRequestInitFunctionConfig {
  /**
   * Optional intercept function to transform all response JSON before returning the result.
   *
   * Useful for cases where an API returns errors with a 200 response.
   */
  readonly interceptJsonResponse?: FetchJsonInterceptJsonResponseFunction;
  /**
   * Optional function to handle JSON parsing errors.
   */
  readonly handleFetchJsonParseErrorFunction?: HandleFetchJsonParseErrorFunction;
}

/**
 * Creates a FetchJsonFunction from the input ConfiguredFetch.
 *
 * @param fetch - the configured fetch function to use for making HTTP requests
 * @param inputConfig - optional configuration or error handler for JSON parsing; when a function is provided it is used as the parse error handler
 * @returns a FetchJsonFunction that performs requests and parses JSON responses
 */
export function fetchJsonFunction(fetch: ConfiguredFetch, inputConfig?: FetchJsonFunctionConfig | HandleFetchJsonParseErrorFunction): FetchJsonFunction {
  let config: FetchJsonFunctionConfig;

  if (typeof inputConfig === 'function') {
    config = {
      handleFetchJsonParseErrorFunction: inputConfig as HandleFetchJsonParseErrorFunction
    };
  } else {
    config = inputConfig ?? {};
  }

  config = {
    ...config,
    handleFetchJsonParseErrorFunction: config.handleFetchJsonParseErrorFunction ?? throwJsonResponseParseErrorFunction
  };

  const { handleFetchJsonParseErrorFunction, interceptJsonResponse } = config;
  const configuredFetchJsonRequestInit = fetchJsonRequestInitFunction(config);

  return (url: FetchURLInput, methodOrInput?: string | FetchJsonInput, body?: FetchJsonBody) => {
    const requestUrl = fetchURL(url);
    const requestInit = configuredFetchJsonRequestInit(methodOrInput, body);

    const inputIntercept = typeof methodOrInput === 'object' ? methodOrInput.interceptResponse : undefined;
    const responsePromise = fetch(requestUrl, requestInit);

    return responsePromise.then((response) => {
      const jsonPromise = response.json().catch(handleFetchJsonParseErrorFunction);
      const interceptedJsonResponsePromise = interceptJsonResponse ? jsonPromise.then((json) => interceptJsonResponse(json, response)) : jsonPromise;
      return inputIntercept ? interceptedJsonResponsePromise.then((result) => inputIntercept(result, response)) : interceptedJsonResponsePromise;
    });
  };
}

export interface FetchJsonRequestInitFunctionConfig {
  /**
   * Default request method.
   *
   * Defaults to GET
   */
  defaultMethod?: string;
  /**
   * Optional map function to modify the FetchJsonInput before it is finalized into a RequestInit value.
   */
  mapFetchJsonInput?: FetchJsonInputMapFunction;
}

export type FetchJsonRequestInitFunction = (methodOrInput?: string | FetchJsonInput | undefined, body?: FetchJsonBody) => RequestInit;

/**
 * Creates a {@link FetchJsonRequestInitFunction} that converts method/body inputs into a fully formed {@link RequestInit},
 * applying the configured default method and optional input mapping.
 *
 * @param config - optional configuration specifying the default HTTP method and an input mapping function
 * @returns a function that produces a {@link RequestInit} from a method string or {@link FetchJsonInput}
 */
export function fetchJsonRequestInitFunction(config: FetchJsonRequestInitFunctionConfig = {}): FetchJsonRequestInitFunction {
  const { defaultMethod = 'GET', mapFetchJsonInput = mapIdentityFunction() } = config;

  return (methodOrInput: string | FetchJsonInput = defaultMethod, body?: FetchJsonBody) => {
    let config: FetchJsonInput;

    if (typeof methodOrInput === 'string') {
      config = {
        method: methodOrInput,
        body
      };
    } else {
      config = methodOrInput;
    }

    config = mapFetchJsonInput(config);

    const requestInit: RequestInit = {
      ...config,
      method: config.method,
      body: fetchJsonBodyString(config.body)
    };

    return requestInit;
  };
}

export const fetchJsonRequestInit = fetchJsonRequestInitFunction();
