import { ConfiguredFetch, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { ZohoServerError, ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, zohoServerErrorData } from '../zoho.error.api';

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
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      default:
        result = result = new ZohoServerError(errorData, responseError);
        break;
    }
  }

  return result;
}

export const interceptZohoRecruitErrorResponse = interceptZohoErrorResponseFactory(parseZohoRecruitServerErrorResponseData);
export const handleZohoRecruitErrorFetch = handleZohoErrorFetchFactory(parseZohoRecruitError, logZohoRecruitErrorToConsole);
