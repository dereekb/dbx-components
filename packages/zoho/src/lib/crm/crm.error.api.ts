import { type FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { type ZohoServerErrorDataWithDetails, type ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData, ZohoServerError, ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE, ZOHO_DUPLICATE_DATA_ERROR_CODE, type ParsedZohoServerError, ZOHO_INVALID_DATA_ERROR_CODE, type ZohoServerErrorResponseDataArrayRef } from '../zoho.error.api';
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

/**
 * Base error for Zoho CRM record CRUD operations. Wraps the server-provided error data including field-level details.
 */
export class ZohoCrmRecordCrudError extends ZohoServerError<ZohoServerErrorDataWithDetails> {}

/**
 * Thrown when a CRM create/update request is missing a required field defined in the module layout.
 */
export class ZohoCrmRecordCrudMandatoryFieldNotFoundError extends ZohoCrmRecordCrudError {}

/**
 * Thrown when a CRM create/update request would produce a duplicate record based on unique field constraints.
 */
export class ZohoCrmRecordCrudDuplicateDataError extends ZohoCrmRecordCrudError {}

/**
 * Key-value map of field-level validation error details returned by the Zoho CRM API for invalid data submissions.
 */
export type ZohoCrmRecordCrudInvalidDataErrorDetails = Record<string, string>;

/**
 * Describes the specific field that caused an invalid data error, as reported by the Zoho CRM API.
 */
export interface ZohoCrmRecordCrudInvalidFieldDetails {
  /**
   * The api name for this field
   *
   * Example: 'id'
   */
  readonly api_name: string;
  /**
   * The json path for this field from the root data.
   *
   * Example: `$.data[0].id`
   */
  readonly json_path: string;
}

/**
 * Thrown when a CRM request contains invalid field data. Provides access to the offending field details via {@link invalidFieldDetails}.
 */
export class ZohoCrmRecordCrudInvalidDataError extends ZohoCrmRecordCrudError {
  get invalidFieldDetails(): ZohoCrmRecordCrudInvalidFieldDetails {
    return this.error.details as ZohoCrmRecordCrudInvalidFieldDetails;
  }
}

/**
 * Thrown when an invalid data error targets the 'id' field, indicating the referenced record does not exist.
 */
export class ZohoCrmRecordCrudNoMatchingRecordError extends ZohoCrmRecordCrudInvalidDataError {}

/**
 * Maps a Zoho CRM server error to the appropriate typed {@link ZohoCrmRecordCrudError} subclass based on the error code and affected field.
 *
 * @param error - The server error data containing the error code and field details
 * @returns The appropriate typed CRM CRUD error instance
 */
export function zohoCrmRecordCrudError(error: ZohoServerErrorDataWithDetails): ZohoCrmRecordCrudError {
  let result: ZohoCrmRecordCrudError;

  switch (error.code) {
    case ZOHO_INVALID_DATA_ERROR_CODE: {
      const invalidDataError = new ZohoCrmRecordCrudInvalidDataError(error);

      if (invalidDataError.invalidFieldDetails.api_name === 'id') {
        result = new ZohoCrmRecordCrudNoMatchingRecordError(error);
      } else {
        result = invalidDataError;
      }
      break;
    }
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

/**
 * Returns an assertion function that throws {@link ZohoCrmRecordNoContentError} when a data array result is empty or null, typically indicating a missing record.
 *
 * @param moduleName - Optional CRM module name for the error context
 * @param recordId - Optional record ID for the error context
 * @returns Assertion function that throws if the data array is empty
 */
export function assertZohoCrmRecordDataArrayResultHasContent<T>(moduleName?: ZohoCrmModuleName, recordId?: ZohoCrmRecordId) {
  return <R extends ZohoDataArrayResultRef<T>>(x: R) => {
    if (!x.data.length) {
      throw new ZohoCrmRecordNoContentError(moduleName, recordId);
    } else {
      return x;
    }
  };
}

/**
 * Pre-configured console logger for Zoho CRM server errors. Data array errors are suppressed since they are handled separately by CRUD error classes.
 */
export const logZohoCrmErrorToConsole = logZohoServerErrorFunction('ZohoCrm', { logDataArrayErrors: false });

/**
 * Parses a fetch response error into a typed Zoho CRM server error by extracting and interpreting the JSON error body.
 *
 * @param responseError - The fetch response error to parse
 * @returns The parsed Zoho server error, or undefined if the response could not be parsed
 */
export async function parseZohoCrmError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef | undefined = await responseError.response.json().catch(() => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoCrmServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Parses a Zoho CRM error response body into a typed error. Delegates to CRM-specific error code handling before falling back to the generic Zoho error parser.
 *
 * @param errorResponseData - The raw error response data from the Zoho CRM API
 * @param responseError - The original fetch response error for context
 * @returns The parsed Zoho server error, or undefined if the error could not be classified
 */
export function parseZohoCrmServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef, responseError: FetchResponseError) {
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

/**
 * Fetch response interceptor that detects Zoho CRM error payloads hidden within HTTP 200 responses and converts them into proper errors.
 */
export const interceptZohoCrm200StatusWithErrorResponse = interceptZohoErrorResponseFactory(parseZohoCrmServerErrorResponseData);

/**
 * Wraps a fetch function with Zoho CRM error parsing and console logging, ensuring all CRM API errors are surfaced as typed exceptions.
 */
export const handleZohoCrmErrorFetch = handleZohoErrorFetchFactory(parseZohoCrmError, logZohoCrmErrorToConsole);
