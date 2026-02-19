import { type FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { type ZohoServerErrorDataWithDetails, type ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData, ZohoServerError, ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE, ZOHO_DUPLICATE_DATA_ERROR_CODE, type ParsedZohoServerError, ZOHO_INVALID_DATA_ERROR_CODE } from '../zoho.error.api';
import { type ZohoCrmModuleName, type ZohoCrmRecordId } from './crm';
import { type ZohoDataArrayResultRef } from '../zoho.api.page';

/**
 * Error code for when two records are already associated with each other.
 *
 * Example being a candidate and a job opening are already associated.
 */
export const ZOHO_CRM_ALREADY_ASSOCIATED_ERROR_CODE = 'ALREADY_ASSOCIATED';

/**
 * Thrown when a record with the given id has no content. Typically also means it does not exist.
 */
export class ZohoCrmRecordNoContentError extends BaseError {
  constructor(
    readonly moduleName?: ZohoCrmModuleName,
    readonly recordId?: ZohoCrmRecordId
  ) {
    super(`There was no content or matching records for the content. It may not exist.`);
  }
}

export class ZohoCrmRecordCrudError extends ZohoServerError<ZohoServerErrorDataWithDetails> {}

export class ZohoCrmRecordCrudMandatoryFieldNotFoundError extends ZohoCrmRecordCrudError {}
export class ZohoCrmRecordCrudDuplicateDataError extends ZohoCrmRecordCrudError {}

export type ZohoCrmRecordCrudInvalidDataErrorDetails = Record<string, string>;

export class ZohoCrmRecordCrudInvalidDataError extends ZohoCrmRecordCrudError {
  get invalidFieldDetails(): ZohoCrmRecordCrudInvalidDataErrorDetails {
    return this.error.details as ZohoCrmRecordCrudInvalidDataErrorDetails;
  }
}

export class ZohoCrmRecordCrudNoMatchingRecordError extends ZohoCrmRecordCrudInvalidDataError {}

export function zohoCrmRecordCrudError(error: ZohoServerErrorDataWithDetails): ZohoCrmRecordCrudError {
  let result: ZohoCrmRecordCrudError;

  switch (error.code) {
    case ZOHO_INVALID_DATA_ERROR_CODE:
      const invalidDataError = new ZohoCrmRecordCrudInvalidDataError(error);

      if (invalidDataError.invalidFieldDetails['id']) {
        result = new ZohoCrmRecordCrudNoMatchingRecordError(error);
      } else {
        result = invalidDataError;
      }
      break;
    case ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE:
      result = new ZohoCrmRecordCrudMandatoryFieldNotFoundError(error);
      break;
    case ZOHO_DUPLICATE_DATA_ERROR_CODE:
      result = new ZohoCrmRecordCrudDuplicateDataError(error);
      break;
    default:
      result = new ZohoCrmRecordCrudError(error);
      break;
  }

  return result;
}

export function assertZohoCrmRecordDataArrayResultHasContent<T>(moduleName?: ZohoCrmModuleName, recordId?: ZohoCrmRecordId) {
  return <R extends ZohoDataArrayResultRef<T>>(x: R) => {
    if (x == null || !x.data?.length) {
      throw new ZohoCrmRecordNoContentError(moduleName, recordId);
    } else {
      return x;
    }
  };
}

export const logZohoCrmErrorToConsole = logZohoServerErrorFunction('ZohoCrm');

export async function parseZohoCrmError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch((x) => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoCrmServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseZohoCrmServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError) {
  let result: ParsedZohoServerError | undefined;
  const error = tryFindZohoServerErrorData(errorResponseData, responseError);

  if (error) {
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      // TODO: Add crm-specific error codes here.
      default:
        result = parseZohoServerErrorResponseData(errorResponseData, responseError);
        break;
    }
  }

  return result;
}

export const interceptZohoCrm200StatusWithErrorResponse = interceptZohoErrorResponseFactory(parseZohoCrmServerErrorResponseData);
export const handleZohoCrmErrorFetch = handleZohoErrorFetchFactory(parseZohoCrmError, logZohoCrmErrorToConsole);
