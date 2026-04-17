import { type FetchResponseError } from '@dereekb/util/fetch';
import { type ZohoServerErrorResponseData, type ZohoServerErrorResponseDataArrayRef, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData, type ParsedZohoServerError } from '../zoho.error.api';

/**
 * Pre-configured console logger for Zoho Desk server errors.
 * Data array errors are suppressed since they are handled separately.
 */
export const logZohoDeskErrorToConsole = logZohoServerErrorFunction('ZohoDesk', { logDataArrayErrors: false });

/**
 * Parses a fetch response error into a typed Zoho Desk server error by extracting and interpreting the JSON error body.
 *
 * @param responseError - The fetch response error to parse
 * @returns The parsed Zoho server error, or undefined if the response could not be parsed
 */
export async function parseZohoDeskError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef | undefined = await responseError.response.json().catch(() => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoDeskServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Parses a Zoho Desk error response body into a typed error. Delegates to Desk-specific
 * error code handling before falling back to the generic Zoho error parser.
 *
 * @param errorResponseData - The raw error response data from the Zoho Desk API
 * @param responseError - The original fetch response error for context
 * @returns The parsed Zoho server error, or undefined if the error could not be classified
 */
export function parseZohoDeskServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef, responseError: FetchResponseError) {
  let result: ParsedZohoServerError | undefined;
  const error = tryFindZohoServerErrorData(errorResponseData, responseError);

  if (error) {
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      // TODO: Add Desk-specific error codes here as we encounter them.
      default:
        result = parseZohoServerErrorResponseData(errorResponseData, responseError);
        break;
    }
  }

  return result;
}

/**
 * Fetch response interceptor that detects Zoho Desk error payloads hidden within HTTP 200 responses
 * and converts them into proper errors.
 */
export const interceptZohoDesk200StatusWithErrorResponse = interceptZohoErrorResponseFactory(parseZohoDeskServerErrorResponseData);

/**
 * Wraps a fetch function with Zoho Desk error parsing and console logging,
 * ensuring all Desk API errors are surfaced as typed exceptions.
 */
export const handleZohoDeskErrorFetch = handleZohoErrorFetchFactory(parseZohoDeskError, logZohoDeskErrorToConsole);
