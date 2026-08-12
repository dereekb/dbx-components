import { type Maybe } from '@dereekb/util';
import { type FetchResponseError } from '@dereekb/util/fetch';
import { type CalcomServerErrorCode, type CalcomServerErrorData, handleCalcomErrorFetchFactory, logCalcomServerErrorFunction, parseCalcomServerErrorData, type ParsedCalcomServerError } from '../calcom.error.api';

// MARK: Parser
export const logCalcomErrorToConsole = logCalcomServerErrorFunction('Calcom');

/**
 * The error envelope returned by the Cal.com v2 API.
 *
 * The code and message are nested under `error` — they are NOT top-level fields on the body.
 */
export interface CalcomApiErrorResponseBody {
  readonly status?: Maybe<string>;
  readonly timestamp?: Maybe<string>;
  readonly path?: Maybe<string>;
  readonly error?: Maybe<{
    readonly code?: Maybe<CalcomServerErrorCode>;
    readonly message?: Maybe<string>;
    readonly details?: Maybe<unknown>;
  }>;
}

/**
 * Flattens a Cal.com API error response body into {@link CalcomServerErrorData}.
 *
 * Reads the nested `error` envelope when present, and otherwise treats the body as already
 * flat — so an endpoint that returns a bare error object still yields its code and message.
 *
 * @param body - The parsed error response body.
 * @returns The flattened error data.
 */
export function calcomServerErrorDataFromApiErrorResponseBody(body: CalcomApiErrorResponseBody): CalcomServerErrorData {
  const { error, status } = body;
  const flatBody = body as CalcomServerErrorData;

  return {
    code: error?.code ?? flatBody.code,
    message: error?.message ?? flatBody.message,
    details: error?.details ?? flatBody.details,
    status: status ?? undefined
  } as CalcomServerErrorData;
}

/**
 * Parses a FetchResponseError from a Cal.com API call into a typed CalcomServerError.
 * Attempts to extract JSON error data from the response body.
 *
 * @param responseError - The fetch response error to parse.
 * @returns A parsed CalcomServerError, or undefined if the response body cannot be parsed.
 */
export async function parseCalcomApiError(responseError: FetchResponseError) {
  const body: CalcomApiErrorResponseBody | undefined = await responseError.response.json().catch((_x) => undefined);
  let result: ParsedCalcomServerError | undefined;

  if (body) {
    result = parseCalcomApiServerErrorResponseData(calcomServerErrorDataFromApiErrorResponseBody(body), responseError);
  }

  return result;
}

/**
 * Parses Cal.com API server error response data into a specific error type.
 * Delegates to {@link parseCalcomServerErrorData} for general error classification.
 *
 * @param calcomServerError - The parsed error data from the Cal.com response body.
 * @param responseError - The original FetchResponseError containing the HTTP response.
 * @returns A parsed CalcomServerError, or undefined if the error data is falsy.
 */
export function parseCalcomApiServerErrorResponseData(calcomServerError: CalcomServerErrorData, responseError: FetchResponseError) {
  let result: ParsedCalcomServerError | undefined;

  if (calcomServerError) {
    switch (calcomServerError.code) {
      default:
        result = parseCalcomServerErrorData(calcomServerError, responseError);
        break;
    }
  }

  return result;
}

export const handleCalcomErrorFetch = handleCalcomErrorFetchFactory(parseCalcomApiError, logCalcomErrorToConsole);
