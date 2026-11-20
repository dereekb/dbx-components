import { mapIdentityFunction, parseJsonOrUndefined, type MapSameFunction, type Maybe } from '@dereekb/util';
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
export function fetchJsonBodyString(body: Maybe<FetchJsonBody>): Maybe<string> {
  return body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
}

export interface FetchJsonInput extends Omit<RequestInit, 'body'> {
  readonly method: FetchMethod;
  readonly body?: Maybe<FetchJsonBody>;
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

export type HandleFetchJsonParseErrorFunction = (response: Response) => Maybe<string>;

export const throwJsonResponseParseErrorFunction: HandleFetchJsonParseErrorFunction = (response: Response) => {
  throw new JsonResponseParseError(response);
};

export const returnNullHandleFetchJsonParseErrorFunction: HandleFetchJsonParseErrorFunction = (_response: Response) => null;

/**
 * Turns a {@link Response} into its decoded value. Rejects when the body cannot be decoded, which hands the response to the
 * configured {@link HandleFetchJsonParseErrorFunction}.
 */
export type FetchJsonDecodeResponseFunction = (response: Response) => Promise<unknown>;

/**
 * The default {@link FetchJsonDecodeResponseFunction}: `response.json()`.
 *
 * @param response - The response to decode.
 * @returns The decoded JSON.
 */
export const DEFAULT_FETCH_JSON_DECODE_RESPONSE_FUNCTION: FetchJsonDecodeResponseFunction = (response) => response.json();

/**
 * The result of {@link readFetchJsonText}: the response, its body text (read once) and the decoded value.
 */
export interface FetchJsonTextResult<T = unknown> {
  readonly response: Response;
  /**
   * The raw body text. Always present; the body is read exactly once.
   */
  readonly text: string;
  /**
   * The decoded value, or undefined when the text was not JSON.
   *
   * `T` is the caller's claim about the body. It is never validated, exactly like {@link FetchJsonFunction}'s result type.
   */
  readonly json: Maybe<T>;
  /**
   * False when the text was not JSON. Tells a non-JSON body apart from one that decoded to `null`.
   */
  readonly parsed: boolean;
}

/**
 * Decodes body text into a value. Returning undefined, or throwing, both mean "not JSON".
 */
export type ReadFetchJsonTextParseJsonFunction = (text: string) => unknown;

export interface ReadFetchJsonTextConfig {
  /**
   * Text decoder. Defaults to `@dereekb/util`'s `parseJsonOrUndefined`.
   *
   * JSON repair is never on by default; opt in by passing a repairing decoder, such as
   * `(text) => repairJsonObjectOrUndefined(text)`.
   */
  readonly parseJson?: Maybe<ReadFetchJsonTextParseJsonFunction>;
}

/**
 * Awaits a fetch, reads its body as text once, and decodes that text as JSON.
 *
 * Never throws for a non-ok status or a non-JSON body: the caller reads `response.ok`, `parsed` and `text`. Rejects only
 * when the request itself or the body read fails, with that original error, so a later classifier still sees it.
 *
 * @param responsePromise - The pending fetch. A caller already holding a Response passes `Promise.resolve(response)`.
 * @param config - Optional decoder override.
 * @returns The response, its raw text and the decoded value.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilKind function
 * @dbxUtilTags fetch, json, response, text, body, parse, read
 */
export async function readFetchJsonText<T = unknown>(responsePromise: Promise<Response>, config?: Maybe<ReadFetchJsonTextConfig>): Promise<FetchJsonTextResult<T>> {
  const response = await responsePromise;
  const text = await response.text();
  const parseJson = config?.parseJson ?? parseJsonOrUndefined;

  let json: unknown;

  try {
    json = parseJson(text);
  } catch {
    json = undefined; // a throwing decoder (e.g. plain JSON.parse) means "not JSON"
  }

  return { response, text, json: json as Maybe<T>, parsed: json !== undefined };
}

/**
 * Creates a {@link FetchJsonDecodeResponseFunction} built on {@link readFetchJsonText}.
 *
 * Rejects with a {@link JsonResponseParseError} when the text is not JSON, so the configured parse-error handler still runs.
 * The decoder consumes the body, so the handler cannot re-read it; `response.json()` behaves the same way.
 *
 * @param config - Optional decoder override, e.g. a repairing `parseJson`.
 * @returns A decoder to pass as {@link FetchJsonFunctionConfig.decodeResponse}.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilKind factory
 * @dbxUtilTags fetch, json, decode, response, repair, factory
 *
 * @__NO_SIDE_EFFECTS__
 */
export function fetchJsonTextDecodeResponseFunction(config?: Maybe<ReadFetchJsonTextConfig>): FetchJsonDecodeResponseFunction {
  return (response) =>
    readFetchJsonText(Promise.resolve(response), config).then((result) => {
      if (!result.parsed) {
        throw new JsonResponseParseError(response);
      }

      return result.json;
    });
}

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
  /**
   * How a response becomes a value. Defaults to {@link DEFAULT_FETCH_JSON_DECODE_RESPONSE_FUNCTION} (`response.json()`).
   *
   * A rejection is handed to {@link handleFetchJsonParseErrorFunction} together with the response.
   */
  readonly decodeResponse?: FetchJsonDecodeResponseFunction;
}

/**
 * Creates a FetchJsonFunction from the input ConfiguredFetch.
 *
 * @param fetch - The configured fetch function to use for making HTTP requests.
 * @param inputConfig - Optional configuration or error handler for JSON parsing; when a function is provided it is used as the parse error handler.
 * @returns A FetchJsonFunction that performs requests and parses JSON responses.
 */
export function fetchJsonFunction(fetch: ConfiguredFetch, inputConfig?: FetchJsonFunctionConfig | HandleFetchJsonParseErrorFunction): FetchJsonFunction {
  let config: FetchJsonFunctionConfig;

  if (typeof inputConfig === 'function') {
    config = {
      handleFetchJsonParseErrorFunction: inputConfig
    };
  } else {
    config = inputConfig ?? {};
  }

  const { interceptJsonResponse } = config;
  const handleParseError = config.handleFetchJsonParseErrorFunction ?? throwJsonResponseParseErrorFunction;
  const decodeResponse = config.decodeResponse ?? DEFAULT_FETCH_JSON_DECODE_RESPONSE_FUNCTION;
  const configuredFetchJsonRequestInit = fetchJsonRequestInitFunction(config);

  return ((url: FetchURLInput, methodOrInput?: string | FetchJsonInput, body?: FetchJsonBody) => {
    const requestUrl = fetchURL(url);
    const requestInit = configuredFetchJsonRequestInit(methodOrInput, body);

    const inputIntercept = typeof methodOrInput === 'object' ? methodOrInput.interceptResponse : undefined;
    const responsePromise = fetch(requestUrl, requestInit);

    return responsePromise.then((response) => {
      const jsonPromise = decodeResponse(response).catch(() => handleParseError(response));
      const interceptedJsonResponsePromise = interceptJsonResponse ? jsonPromise.then((json) => interceptJsonResponse(json, response)) : jsonPromise;
      return inputIntercept ? interceptedJsonResponsePromise.then((result) => inputIntercept(result, response)) : interceptedJsonResponsePromise;
    });
  }) as FetchJsonFunction; // the result type R is the caller's claim, never validated
}

export interface FetchJsonRequestInitFunctionConfig {
  /**
   * Default request method.
   *
   * Defaults to GET
   */
  readonly defaultMethod?: string;
  /**
   * Optional map function to modify the FetchJsonInput before it is finalized into a RequestInit value.
   */
  readonly mapFetchJsonInput?: FetchJsonInputMapFunction;
}

export type FetchJsonRequestInitFunction = (methodOrInput?: Maybe<string | FetchJsonInput>, body?: FetchJsonBody) => RequestInit;

/**
 * Creates a {@link FetchJsonRequestInitFunction} that converts method/body inputs into a fully formed {@link RequestInit},
 * applying the configured default method and optional input mapping.
 *
 * @param config - Default-method and input-mapping overrides applied by the generated function.
 * @returns Reusable builder that resolves a `RequestInit` for each request.
 */
export function fetchJsonRequestInitFunction(config: FetchJsonRequestInitFunctionConfig = {}): FetchJsonRequestInitFunction {
  const { defaultMethod = 'GET', mapFetchJsonInput = mapIdentityFunction() } = config;

  return (methodOrInput: Maybe<string | FetchJsonInput> = defaultMethod, body?: FetchJsonBody) => {
    let config: FetchJsonInput;

    if (typeof methodOrInput === 'string') {
      config = {
        method: methodOrInput,
        body
      };
    } else {
      config = methodOrInput ?? { method: defaultMethod, body };
    }

    config = mapFetchJsonInput(config);

    const requestInit: RequestInit = {
      ...config,
      method: config.method,
      body: fetchJsonBodyString(config.body) ?? null
    };

    return requestInit;
  };
}

export const fetchJsonRequestInit = fetchJsonRequestInitFunction();
