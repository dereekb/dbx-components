import { FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { ZoomServerErrorResponseData, handleZoomErrorFetchFactory, interceptZoomErrorResponseFactory, logZoomServerErrorFunction, parseZoomServerErrorResponseData, zoomServerErrorData, ParsedZoomServerError } from '../zoom.error.api';

/**
 * Error in the following cases:
 * - the refresh token string is invalid
 */
export const ZOOM_ACCOUNTS_INVALID_CODE_ERROR_CODE = 'invalid_code';
export const ZOOM_ACCOUNTS_INVALID_CLIENT_ERROR_CODE = 'invalid_client';

export type ZoomOAuthAccessTokenErrorCode = typeof ZOOM_ACCOUNTS_INVALID_CODE_ERROR_CODE | typeof ZOOM_ACCOUNTS_INVALID_CLIENT_ERROR_CODE;

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
  const data: ZoomServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ParsedZoomServerError | undefined;

  if (data) {
    result = parseZoomOAuthServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZoomOAuthServerErrorResponseData(errorResponseData: ZoomServerErrorResponseData, responseError: FetchResponseError) {
  let result: ParsedZoomServerError | undefined;
  const error = errorResponseData.error;

  if (error) {
    const errorData = zoomServerErrorData(error);

    switch (errorData.code) {
      case ZOOM_ACCOUNTS_INVALID_CODE_ERROR_CODE:
      case ZOOM_ACCOUNTS_INVALID_CLIENT_ERROR_CODE:
        result = new ZoomOAuthAccessTokenError(errorData.code);
        break;
      default:
        result = parseZoomServerErrorResponseData(errorResponseData, responseError);
        break;
    }
  }

  return result;
}

export const interceptZoomOAuthErrorResponse = interceptZoomErrorResponseFactory(parseZoomOAuthServerErrorResponseData);
export const handleZoomOAuthErrorFetch = handleZoomErrorFetchFactory(parseZoomOAuthError, logZoomOAuthErrorToConsole);
