import { FetchRequestFactoryError, type FetchResponseError } from '@dereekb/util/fetch';
import { type ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, zohoServerErrorData, type ParsedZohoServerError } from '../zoho.error.api';

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

/**
 * Parses a fetch response error into a typed Zoho Accounts server error by extracting and interpreting the JSON error body.
 *
 * @param responseError - The fetch response error to parse
 * @returns The parsed Zoho server error, or undefined if the response could not be parsed
 */
export async function parseZohoAccountsError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch(() => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoAccountsServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Parses a Zoho Accounts error response body into a typed error. Handles account-specific error codes before falling back to the generic Zoho error parser.
 *
 * @param errorResponseData - The raw error response data from the Zoho Accounts API
 * @param responseError - The original fetch response error for context
 * @returns The parsed Zoho server error, or undefined if the error could not be classified
 */
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

export const interceptZohoAccounts200StatusWithErrorResponse = interceptZohoErrorResponseFactory(parseZohoAccountsServerErrorResponseData);
export const handleZohoAccountsErrorFetch = handleZohoErrorFetchFactory(parseZohoAccountsError, logZohoAccountsErrorToConsole);
