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
  method: FetchMethod;
  body?: FetchJsonBody | undefined;
}

export type FetchJsonInputMapFunction = MapSameFunction<FetchJsonInput>;

export type FetchJsonGetFunction = <R>(url: FetchURLInput) => Promise<R>;
export type FetchJsonMethodAndBodyFunction = <R>(url: FetchURLInput, method: string, body?: FetchJsonBody) => Promise<R>;
export type FetchJsonWithInputFunction = <R>(url: FetchURLInput, input: FetchJsonInput) => Promise<R>;

/**
 * Used to fetch from the input url and retrieve a JSON response.
 */
export type FetchJsonFunction = FetchJsonGetFunction & FetchJsonMethodAndBodyFunction & FetchJsonWithInputFunction;

export type HandleFetchJsonParseErrorFunction = (response: Response) => string | null | never;

export const throwJsonResponseParseErrorFunction: HandleFetchJsonParseErrorFunction = (response: Response) => {
  throw new JsonResponseParseError(response);
};

export const returnNullHandleFetchJsonParseErrorFunction: HandleFetchJsonParseErrorFunction = (response: Response) => null;

export interface FetchJsonFunctionConfig extends FetchJsonRequestInitFunctionConfig {
  handleFetchJsonParseErrorFunction?: HandleFetchJsonParseErrorFunction;
}

/**
 * Creates a FetchJsonFunction from the input ConfiguredFetch.
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

  const { handleFetchJsonParseErrorFunction } = config;
  const configuredFetchJsonRequestInit = fetchJsonRequestInitFunction(config);

  return (url: FetchURLInput, methodOrInput?: string | FetchJsonInput, body?: FetchJsonBody) => {
    const requestUrl = fetchURL(url);
    const requestInit = configuredFetchJsonRequestInit(methodOrInput, body);
    const response = fetch(requestUrl, requestInit);
    return response.then((x) => x.json().catch(handleFetchJsonParseErrorFunction));
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

export function fetchJsonRequestInitFunction(config: FetchJsonRequestInitFunctionConfig = {}): FetchJsonRequestInitFunction {
  const { defaultMethod = 'GET', mapFetchJsonInput = mapIdentityFunction() } = config;

  return (methodOrInput: string | FetchJsonInput = defaultMethod, body?: FetchJsonBody) => {
    let config: FetchJsonInput;

    if (methodOrInput === null) {
      config = {
        method: defaultMethod
      };
    } else if (typeof methodOrInput === 'string') {
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
      method: config.method ?? defaultMethod,
      body: fetchJsonBodyString(config.body)
    };

    return requestInit;
  };
}

export const fetchJsonRequestInit = fetchJsonRequestInitFunction();
