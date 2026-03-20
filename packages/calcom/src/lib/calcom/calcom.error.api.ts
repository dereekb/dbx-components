import { type FetchResponseError } from '@dereekb/util/fetch';
import { type CalcomServerErrorData, handleCalcomErrorFetchFactory, logCalcomServerErrorFunction, parseCalcomServerErrorData, type ParsedCalcomServerError } from '../calcom.error.api';

// MARK: Parser
export const logCalcomErrorToConsole = logCalcomServerErrorFunction('Calcom');

/**
 * Parses a FetchResponseError from a Cal.com API call into a typed CalcomServerError.
 * Attempts to extract JSON error data from the response body.
 *
 * @param responseError - the fetch response error to parse
 * @returns a parsed CalcomServerError, or undefined if the response body cannot be parsed
 */
export async function parseCalcomApiError(responseError: FetchResponseError) {
  const data: CalcomServerErrorData | undefined = await responseError.response.json().catch((_x) => undefined);
  let result: ParsedCalcomServerError | undefined;

  if (data) {
    result = parseCalcomApiServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Parses Cal.com API server error response data into a specific error type.
 * Delegates to {@link parseCalcomServerErrorData} for general error classification.
 *
 * @param calcomServerError - the parsed error data from the Cal.com response body
 * @param responseError - the original FetchResponseError containing the HTTP response
 * @returns a parsed CalcomServerError, or undefined if the error data is falsy
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
