import { FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { ZoomServerErrorDataWithDetails, ZoomServerErrorData, handleZoomErrorFetchFactory, logZoomServerErrorFunction, parseZoomServerErrorData, ZoomServerError, ParsedZoomServerError } from '../zoom.error.api';
import { ZoomOAuthAccessTokenErrorCode } from '../oauth';

// MARK: Parser
export const logZoomErrorToConsole = logZoomServerErrorFunction('Zoom');

export async function parseZoomApiError(responseError: FetchResponseError) {
  const data: ZoomServerErrorData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ParsedZoomServerError | undefined;

  if (data) {
    result = parseZoomApiServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZoomApiServerErrorResponseData(zoomServerError: ZoomServerErrorData, responseError: FetchResponseError) {
  let result: ParsedZoomServerError | undefined;

  if (zoomServerError) {
    switch (zoomServerError.code) {
      default:
        result = parseZoomServerErrorData(zoomServerError, responseError);
        break;
    }
  }

  return result;
}

export const handleZoomErrorFetch = handleZoomErrorFetchFactory(parseZoomApiError, logZoomErrorToConsole);
