import { FetchRequestFactoryError, type FetchResponseError } from '@dereekb/util/fetch';
import { type CalcomServerErrorData, handleCalcomErrorFetchFactory, logCalcomServerErrorFunction, parseCalcomServerErrorData, type ParsedCalcomServerError } from '../calcom.error.api';

/**
 * Error in the following cases:
 * - the refresh token string is invalid
 */
export const CALCOM_OAUTH_INVALID_GRANT_ERROR_CODE = 'invalid_grant';

export type CalcomOAuthAccessTokenErrorCode = typeof CALCOM_OAUTH_INVALID_GRANT_ERROR_CODE;

/**
 * Thrown if the call to the Cal.com API creating an access token using a refresh token fails.
 */
export class CalcomOAuthAccessTokenError extends FetchRequestFactoryError {
  constructor(readonly errorCode: CalcomOAuthAccessTokenErrorCode) {
    super(`CalcomOAuthAccessTokenError: ${errorCode}`);
  }
}

/**
 * Thrown if a valid CalcomAccessToken cannot be retrieved successfully.
 */
export class CalcomOAuthAuthFailureError extends FetchRequestFactoryError {
  constructor(readonly reason?: string) {
    super(`Failed to retrieve proper authentication for the API call. Reason: ${reason}`);
  }
}

export const logCalcomOAuthErrorToConsole = logCalcomServerErrorFunction('CalcomOAuth');

/**
 * Parses a FetchResponseError from a Cal.com OAuth call into a typed error.
 * Attempts to extract JSON error data from the response body.
 *
 * @param responseError - the fetch response error to parse
 * @returns a parsed CalcomServerError or CalcomOAuthAccessTokenError, or undefined if unparseable
 */
export async function parseCalcomOAuthError(responseError: FetchResponseError) {
  const data: CalcomServerErrorData | undefined = await responseError.response.json().catch((_x) => undefined);
  let result: ParsedCalcomServerError | undefined;

  if (data) {
    result = parseCalcomOAuthServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Parses Cal.com OAuth server error response data into a specific error type.
 * Handles known error codes like `invalid_grant` and delegates unknown errors
 * to {@link parseCalcomServerErrorData}.
 *
 * @param calcomServerError - the parsed error data from the Cal.com OAuth response body
 * @param responseError - the original FetchResponseError containing the HTTP response
 * @returns a parsed error instance, or undefined if the error data is falsy
 */
export function parseCalcomOAuthServerErrorResponseData(calcomServerError: CalcomServerErrorData, responseError: FetchResponseError) {
  let result: ParsedCalcomServerError | undefined;

  if (calcomServerError) {
    const potentialErrorStringCode = (calcomServerError as unknown as { error: string }).error;
    const errorCode = potentialErrorStringCode ?? calcomServerError.code;

    switch (errorCode) {
      case CALCOM_OAUTH_INVALID_GRANT_ERROR_CODE:
        result = new CalcomOAuthAccessTokenError(errorCode);
        break;
      default:
        result = parseCalcomServerErrorData(calcomServerError, responseError);
        break;
    }
  }

  return result;
}

export const handleCalcomOAuthErrorFetch = handleCalcomErrorFetchFactory(parseCalcomOAuthError, logCalcomOAuthErrorToConsole);
