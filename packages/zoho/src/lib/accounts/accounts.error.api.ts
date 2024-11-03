import { FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { ZohoServerFetchResponseError, ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, zohoServerErrorData } from '../zoho.error.api';

export type ZohoAccountsAccessTokenErrorCode = 'invalid_code' | 'invalid_client';

/**
 * Thrown if the call to the Zoho API creating an access token using a refresh token fails.
 */
export class ZohoAccountsAccessTokenError extends FetchRequestFactoryError {
  constructor(readonly errorCode: ZohoAccountsAccessTokenErrorCode) {
    super(`ZohoAccountsAccessTokenError: ${errorCode}`);
  }
}

/**
 * Thrown if a valid ZohoAccessToken cannot be retrieved successfully.
 */
export class ZohoAccountsAuthFailureError extends FetchRequestFactoryError {
  constructor(readonly reason?: string) {
    super(`Failed to retrieve proper authentication for the API call. Reason: ${reason}`);
  }
}

export const logZohoAccountsErrorToConsole = logZohoServerErrorFunction('ZohoAccounts');

export async function parseZohoAccountsError(responseError: FetchResponseError): Promise<ZohoServerFetchResponseError | undefined> {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ZohoServerFetchResponseError | undefined;

  if (data) {
    result = parseZohoAccountsServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZohoAccountsServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError): ZohoServerFetchResponseError | undefined {
  let result: ZohoServerFetchResponseError | undefined;
  const error = errorResponseData.error;

  if (error) {
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      default:
        result = parseZohoServerErrorResponseData(errorResponseData, responseError);
        break;
    }
  }

  return result;
}

export const interceptZohoAccountsErrorResponse = interceptZohoErrorResponseFactory(parseZohoAccountsServerErrorResponseData);
export const handleZohoAccountsErrorFetch = handleZohoErrorFetchFactory(parseZohoAccountsError, logZohoAccountsErrorToConsole);
