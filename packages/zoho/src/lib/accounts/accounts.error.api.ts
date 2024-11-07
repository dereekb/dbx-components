import { FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, zohoServerErrorData, ParsedZohoServerError } from '../zoho.error.api';

/**
 * Error in the following cases:
 * - the refresh token string is invalid
 */
export const ZOHO_ACCOUNTS_INVALID_CODE_ERROR_CODE = 'invalid_code';
export const ZOHO_ACCOUNTS_INVALID_CLIENT_ERROR_CODE = 'invalid_client';

export type ZohoAccountsAccessTokenErrorCode = typeof ZOHO_ACCOUNTS_INVALID_CODE_ERROR_CODE | typeof ZOHO_ACCOUNTS_INVALID_CLIENT_ERROR_CODE;

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

export async function parseZohoAccountsError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoAccountsServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZohoAccountsServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError) {
  let result: ParsedZohoServerError | undefined;
  const error = errorResponseData.error;

  if (error) {
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      case ZOHO_ACCOUNTS_INVALID_CODE_ERROR_CODE:
      case ZOHO_ACCOUNTS_INVALID_CLIENT_ERROR_CODE:
        result = new ZohoAccountsAccessTokenError(errorData.code);
        break;
      default:
        result = parseZohoServerErrorResponseData(errorResponseData, responseError);
        break;
    }
  }

  return result;
}

export const interceptZohoAccountsErrorResponse = interceptZohoErrorResponseFactory(parseZohoAccountsServerErrorResponseData);
export const handleZohoAccountsErrorFetch = handleZohoErrorFetchFactory(parseZohoAccountsError, logZohoAccountsErrorToConsole);
