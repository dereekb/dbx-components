import { FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { ZoomServerErrorData, handleZoomErrorFetchFactory, logZoomServerErrorFunction, parseZoomServerErrorData, ParsedZoomServerError } from '../zoom.error.api';

/**
 * Error in the following cases:
 * - the refresh token string is invalid
 */
export const ZOOM_ACCOUNTS_INVALID_GRANT_ERROR_CODE = 'invalid_grant';

export type ZoomOAuthAccessTokenErrorCode = typeof ZOOM_ACCOUNTS_INVALID_GRANT_ERROR_CODE;

/**
 * Thrown if the call to the Zoom API creating an access token using a refresh token fails.
 */
export class ZoomOAuthAccessTokenError extends FetchRequestFactoryError {
  constructor(readonly errorCode: ZoomOAuthAccessTokenErrorCode) {
    super(`ZoomOAuthAccessTokenError: ${errorCode}`);
  }
}

/**
 * Thrown if a valid ZoomAccessToken cannot be retrieved successfully.
 */
export class ZoomOAuthAuthFailureError extends FetchRequestFactoryError {
  constructor(readonly reason?: string) {
    super(`Failed to retrieve proper authentication for the API call. Reason: ${reason}`);
  }
}

export const logZoomOAuthErrorToConsole = logZoomServerErrorFunction('ZoomOAuth');

export async function parseZoomOAuthError(responseError: FetchResponseError) {
  const data: ZoomServerErrorData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ParsedZoomServerError | undefined;

  if (data) {
    result = parseZoomOAuthServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZoomOAuthServerErrorResponseData(zoomServerError: ZoomServerErrorData, responseError: FetchResponseError) {
  let result: ParsedZoomServerError | undefined;

  if (zoomServerError) {
    switch (zoomServerError.code) {
      case ZOOM_ACCOUNTS_INVALID_GRANT_ERROR_CODE:
        result = new ZoomOAuthAccessTokenError(zoomServerError.code);
        break;
      default:
        result = parseZoomServerErrorData(zoomServerError, responseError);
        break;
    }
  }

  return result;
}

export const handleZoomOAuthErrorFetch = handleZoomErrorFetchFactory(parseZoomOAuthError, logZoomOAuthErrorToConsole);
