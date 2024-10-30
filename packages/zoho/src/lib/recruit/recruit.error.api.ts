import { ConfiguredFetch, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { ZohoServerError, ZohoServerErrorResponseData, handleZohoErrorFetchFactory, logZohoServerErrorFunction } from '../zoho.api.error';

export const logZohoRecruitErrorToConsole = logZohoServerErrorFunction('ZohoRecruit');

export async function parseZohoRecruitError(responseError: FetchResponseError): Promise<ZohoServerError | undefined> {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ZohoServerError | undefined;

  if (data) {
    result = parseZohoRecruitServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZohoRecruitServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError): ZohoServerError | undefined {
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

export const handleZohoRecruitErrorFetch = handleZohoErrorFetchFactory(parseZohoRecruitError, logZohoRecruitErrorToConsole);
