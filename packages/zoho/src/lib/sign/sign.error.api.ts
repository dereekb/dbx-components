import { type FetchResponseError } from '@dereekb/util/fetch';
import { type ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData, type ParsedZohoServerError, type ZohoServerErrorResponseDataArrayRef } from '../zoho.error.api';

export const logZohoSignErrorToConsole = logZohoServerErrorFunction('ZohoSign', { logDataArrayErrors: false });

export async function parseZohoSignError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef | undefined = await responseError.response.json().catch(() => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoSignServerErrorResponseData(data, responseError);
  }

  return result;
}

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
