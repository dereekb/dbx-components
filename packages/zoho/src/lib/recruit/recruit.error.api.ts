import { FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { ZohoServerErrorDataWithDetails, ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData, ZohoServerError, ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE, ZOHO_DUPLICATE_DATA_ERROR_CODE, ParsedZohoServerError, ZOHO_INVALID_DATA_ERROR_CODE } from '../zoho.error.api';
import { ZohoRecruitModuleName, ZohoRecruitRecordId } from './recruit';
import { ZohoDataArrayResultRef } from '../zoho.api.page';

/**
 * Thrown when a record with the given id has no content. Typically also means it does not exist.
 */
export class ZohoRecruitRecordNoContentError extends BaseError {
  constructor(
    readonly moduleName?: ZohoRecruitModuleName,
    readonly recordId?: ZohoRecruitRecordId
  ) {
    super(`There was no content or matching records for the content. It may not exist.`);
  }
}

export class ZohoRecruitRecordCrudError extends ZohoServerError<ZohoServerErrorDataWithDetails> {}

export class ZohoRecruitRecordCrudMandatoryFieldNotFoundError extends ZohoRecruitRecordCrudError {}
export class ZohoRecruitRecordCrudDuplicateDataError extends ZohoRecruitRecordCrudError {}

export type ZohoRecruitRecordCrudInvalidDataErrorDetails = Record<string, string>;

export class ZohoRecruitRecordCrudInvalidDataError extends ZohoRecruitRecordCrudError {
  get invalidFieldDetails(): ZohoRecruitRecordCrudInvalidDataErrorDetails {
    return this.error.details as ZohoRecruitRecordCrudInvalidDataErrorDetails;
  }
}

export class ZohoRecruitRecordCrudNoMatchingRecordError extends ZohoRecruitRecordCrudInvalidDataError {}

export function zohoRecruitRecordCrudError(error: ZohoServerErrorDataWithDetails): ZohoRecruitRecordCrudError {
  let result: ZohoRecruitRecordCrudError;

  switch (error.code) {
    case ZOHO_INVALID_DATA_ERROR_CODE:
      const invalidDataError = new ZohoRecruitRecordCrudInvalidDataError(error);

      if (invalidDataError.invalidFieldDetails['id']) {
        result = new ZohoRecruitRecordCrudNoMatchingRecordError(error);
      } else {
        result = invalidDataError;
      }
      break;
    case ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE:
      result = new ZohoRecruitRecordCrudMandatoryFieldNotFoundError(error);
      break;
    case ZOHO_DUPLICATE_DATA_ERROR_CODE:
      result = new ZohoRecruitRecordCrudDuplicateDataError(error);
      break;
    default:
      result = new ZohoRecruitRecordCrudError(error);
      break;
  }

  return result;
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

export async function parseZohoRecruitError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoRecruitServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZohoRecruitServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError) {
  let result: ParsedZohoServerError | undefined;
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

export const interceptZohoRecruit200StatusWithErrorResponse = interceptZohoErrorResponseFactory(parseZohoRecruitServerErrorResponseData);
export const handleZohoRecruitErrorFetch = handleZohoErrorFetchFactory(parseZohoRecruitError, logZohoRecruitErrorToConsole);
