import { type FetchResponseError } from '@dereekb/util/fetch';
import { type ZoomServerErrorData, handleZoomErrorFetchFactory, logZoomServerErrorFunction, parseZoomServerErrorData, type ParsedZoomServerError } from '../zoom.error.api';

// MARK: Parser
export const logZoomErrorToConsole = logZoomServerErrorFunction('Zoom');

/**
 * Parses a FetchResponseError into a typed Zoom API error.
 *
 * @param responseError The fetch response error to parse
 * @returns The parsed error, or undefined if parsing fails
 */
export async function parseZoomApiError(responseError: FetchResponseError) {
  const data: ZoomServerErrorData | undefined = await responseError.response.json().catch(() => undefined);
  let result: ParsedZoomServerError | undefined;

  if (data) {
    result = parseZoomApiServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Parses a ZoomServerErrorData into a Zoom API-specific error.
 *
 * @param zoomServerError The raw error data from the Zoom API
 * @param responseError The original fetch response error
 * @returns A parsed error, or undefined if the error is unrecognized
 */
export function parseZoomApiServerErrorResponseData(zoomServerError: ZoomServerErrorData, responseError: FetchResponseError) {
  let result: ParsedZoomServerError | undefined;

  {
    switch (zoomServerError.code) {
      default:
        result = parseZoomServerErrorData(zoomServerError, responseError);
        break;
    }
  }

  return result;
}

export const handleZoomErrorFetch = handleZoomErrorFetchFactory(parseZoomApiError, logZoomErrorToConsole);
