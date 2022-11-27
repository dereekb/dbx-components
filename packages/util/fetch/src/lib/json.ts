import { FetchMethod, ConfiguredFetch } from './fetch.type';
import { fetchURL, FetchURLInput } from './url';

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
  body?: FetchJsonBody;
}

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

/**
 * Creates a FetchJsonFunction from the input ConfiguredFetch.
 */
export function fetchJsonFunction(fetch: ConfiguredFetch, handleFetchJsonParseErrorFunction: HandleFetchJsonParseErrorFunction = throwJsonResponseParseErrorFunction): FetchJsonFunction {
  return (url: FetchURLInput, methodOrInput?: string | FetchJsonInput, body?: FetchJsonBody) => {
    const requestUrl = fetchURL(url);
    const requestInit = fetchJsonRequestInit(methodOrInput, body);
    const response = fetch(requestUrl, requestInit);
    return response.then((x) => x.json().catch(handleFetchJsonParseErrorFunction));
  };
}

export function fetchJsonRequestInit(methodOrInput: string | FetchJsonInput = 'GET', body?: FetchJsonBody): RequestInit {
  let config: FetchJsonInput;

  if (methodOrInput === null) {
    config = {
      method: 'GET'
    };
  } else if (typeof methodOrInput === 'string') {
    config = {
      method: methodOrInput,
      body
    };
  } else {
    config = methodOrInput;
  }

  const requestInit: RequestInit = {
    ...config,
    body: fetchJsonBodyString(config.body)
  };

  return requestInit;
}
