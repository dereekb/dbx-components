import { ConfiguredFetch, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { ZohoServerError, ZohoServerErrorResponseData, ZohoServerErrorResponseDataError, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData } from '../zoho.error.api';
import { ZohoRecruitModuleName, ZohoRecruitRecordId } from './recruit';
import { ZohoDataArrayResultRef } from '../zoho.api.page';

export class ZohoRecruitRecordNoContentError extends BaseError {
  constructor(readonly moduleName?: ZohoRecruitModuleName, readonly recordId?: ZohoRecruitRecordId) {
    super(`There was no content or matching records for the content. It may not exist.`);
  }
}

export function assertRecordDataArrayResultHasContent<T>(moduleName?: ZohoRecruitModuleName, recordId?: ZohoRecruitRecordId) {
  return <R extends ZohoDataArrayResultRef<T>>(x: R) => {
    if (x == null || !x.data?.length) {
      throw new ZohoRecruitRecordNoContentError(moduleName, recordId);
    } else {
      return x;
    }
  };
}

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
  const error = tryFindZohoServerErrorData(errorResponseData, responseError);

  if (error) {
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      // TODO: Add recruit-specific error codes here.
      default:
        result = parseZohoServerErrorResponseData(errorResponseData, responseError);
        break;
    }
  }

  return result;
}

export const interceptZohoRecruitErrorResponse = interceptZohoErrorResponseFactory(parseZohoRecruitServerErrorResponseData);
export const handleZohoRecruitErrorFetch = handleZohoErrorFetchFactory(parseZohoRecruitError, logZohoRecruitErrorToConsole);
