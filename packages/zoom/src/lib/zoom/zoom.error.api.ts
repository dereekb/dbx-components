import { FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { ZoomServerErrorDataWithDetails, ZoomServerErrorResponseData, handleZoomErrorFetchFactory, interceptZoomErrorResponseFactory, logZoomServerErrorFunction, parseZoomServerErrorResponseData, ZoomServerError, ParsedZoomServerError } from '../zoom.error.api';

export async function parseZoomError(responseError: FetchResponseError) {
  const data: ZoomServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ParsedZoomServerError | undefined;

  if (data) {
    result = parseZoomServerErrorResponseData(data, responseError);
  }

  return result;
}

export const logZoomErrorToConsole = logZoomServerErrorFunction('Zoom');

export const interceptZoomErrorResponse = interceptZoomErrorResponseFactory(parseZoomServerErrorResponseData);
export const handleZoomErrorFetch = handleZoomErrorFetchFactory(parseZoomError, logZoomErrorToConsole);
