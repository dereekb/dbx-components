import { ConfiguredFetch, FetchResponseError } from '@dereekb/util/fetch';
import { ZohoServerError, ZohoServerErrorResponseData, handleZohoErrorFetchFactory, logZohoServerErrorFunction } from '../zoho.api.error';

export const logZohoAccountsErrorToConsole = logZohoServerErrorFunction('ZohoAccounts');

export async function parseZohoAccountsError(responseError: FetchResponseError): Promise<ZohoServerError | undefined> {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ZohoServerError | undefined;

  if (data) {
    result = parseZohoAccountsServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZohoAccountsServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError): ZohoServerError | undefined {
  let result: ZohoServerError | undefined;
  const error = errorResponseData.error;

  if (error) {
    switch (error.code) {
      default:
        result = new ZohoServerError(error, responseError);
        break;
    }
  }

  return result;
}

export const handleZohoAccountsErrorFetch = handleZohoErrorFetchFactory(parseZohoAccountsError, logZohoAccountsErrorToConsole);
