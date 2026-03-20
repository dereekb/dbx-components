import { type FetchResponseError } from '@dereekb/util/fetch';
import { type ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData, type ParsedZohoServerError, type ZohoServerErrorResponseDataArrayRef } from '../zoho.error.api';

export const logZohoSignErrorToConsole = logZohoServerErrorFunction('ZohoSign', { logDataArrayErrors: false });

/**
 * Parses the JSON body of a failed Zoho Sign fetch response into a structured error, returning undefined if the body cannot be parsed.
 *
 * @param responseError - The fetch response error to parse
 * @returns Parsed Zoho server error, or undefined if parsing fails
 */
export async function parseZohoSignError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef | undefined = await responseError.response.json().catch(() => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoSignServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Converts raw Zoho Sign error response data into a parsed error, delegating to Sign-specific handlers for known error codes and falling back to the shared Zoho parser.
 *
 * @param errorResponseData - Raw error response data from the Zoho Sign API
 * @param responseError - The underlying fetch response error
 * @returns Parsed Zoho server error, or undefined if the data contains no recognizable error
 */
export function parseZohoSignServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef, responseError: FetchResponseError) {
  let result: ParsedZohoServerError | undefined;
  const error = tryFindZohoServerErrorData(errorResponseData, responseError);

  if (error) {
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      // TODO: Add sign-specific error codes here.
      default:
        result = parseZohoServerErrorResponseData(errorResponseData, responseError);
        break;
    }
  }

  return result;
}

export const interceptZohoSign200StatusWithErrorResponse = interceptZohoErrorResponseFactory(parseZohoSignServerErrorResponseData);
export const handleZohoSignErrorFetch = handleZohoErrorFetchFactory(parseZohoSignError, logZohoSignErrorToConsole);
