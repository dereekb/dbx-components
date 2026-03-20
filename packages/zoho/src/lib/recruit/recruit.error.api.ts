import { type FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';
import { type ZohoServerErrorDataWithDetails, type ZohoServerErrorResponseData, handleZohoErrorFetchFactory, interceptZohoErrorResponseFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData, tryFindZohoServerErrorData, zohoServerErrorData, ZohoServerError, ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE, ZOHO_DUPLICATE_DATA_ERROR_CODE, type ParsedZohoServerError, ZOHO_INVALID_DATA_ERROR_CODE } from '../zoho.error.api';
import { type ZohoRecruitModuleName, type ZohoRecruitRecordId } from './recruit';
import { type ZohoDataArrayResultRef } from '../zoho.api.page';

/**
 * Error code for when two records are already associated with each other.
 *
 * Example being a candidate and a job opening are already associated.
 */
export const ZOHO_RECRUIT_ALREADY_ASSOCIATED_ERROR_CODE = 'ALREADY_ASSOCIATED';

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

/**
 * Base error for Zoho Recruit record CRUD operations, carrying structured error details from the API response.
 */
export class ZohoRecruitRecordCrudError extends ZohoServerError<ZohoServerErrorDataWithDetails> {}

/**
 * Thrown when a required field is missing from the record data submitted to Zoho Recruit.
 */
export class ZohoRecruitRecordCrudMandatoryFieldNotFoundError extends ZohoRecruitRecordCrudError {}

/**
 * Thrown when a record cannot be created or updated because it would produce duplicate data in Zoho Recruit.
 */
export class ZohoRecruitRecordCrudDuplicateDataError extends ZohoRecruitRecordCrudError {}

/**
 * Maps field names to their validation error messages, as returned by the Zoho Recruit API for invalid data submissions.
 */
export type ZohoRecruitRecordCrudInvalidDataErrorDetails = Record<string, string>;

/**
 * Thrown when the Zoho Recruit API rejects record data as invalid. Provides per-field error details via {@link invalidFieldDetails}.
 */
export class ZohoRecruitRecordCrudInvalidDataError extends ZohoRecruitRecordCrudError {
  get invalidFieldDetails(): ZohoRecruitRecordCrudInvalidDataErrorDetails {
    return this.error.details as ZohoRecruitRecordCrudInvalidDataErrorDetails;
  }
}

/**
 * Thrown when the 'id' field in the submitted data does not match any existing Zoho Recruit record.
 */
export class ZohoRecruitRecordCrudNoMatchingRecordError extends ZohoRecruitRecordCrudInvalidDataError {}

/**
 * Creates a typed CRUD error subclass based on the error code returned by the Zoho Recruit API, enabling callers to catch specific failure modes.
 *
 * @param error - Structured error data from the Zoho Recruit API response
 * @returns A specific CRUD error subclass matching the error code
 */
export function zohoRecruitRecordCrudError(error: ZohoServerErrorDataWithDetails): ZohoRecruitRecordCrudError {
  let result: ZohoRecruitRecordCrudError;

  switch (error.code) {
    case ZOHO_INVALID_DATA_ERROR_CODE: {
      const invalidDataError = new ZohoRecruitRecordCrudInvalidDataError(error);

      if (invalidDataError.invalidFieldDetails['id']) {
        result = new ZohoRecruitRecordCrudNoMatchingRecordError(error);
      } else {
        result = invalidDataError;
      }
      break;
    }
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

/**
 * Returns an assertion function that throws {@link ZohoRecruitRecordNoContentError} when the data array result is empty or null, indicating the requested record does not exist.
 *
 * @param moduleName - Optional module name for the error context
 * @param recordId - Optional record ID for the error context
 * @returns Assertion function that validates the data array is non-empty
 */
export function assertZohoRecruitRecordDataArrayResultHasContent<T>(moduleName?: ZohoRecruitModuleName, recordId?: ZohoRecruitRecordId) {
  return <R extends ZohoDataArrayResultRef<T>>(x: R) => {
    // eslint-disable-next-line eqeqeq -- fetchJson may return null for empty results despite type
    if (x == null || !x.data?.length) {
      throw new ZohoRecruitRecordNoContentError(moduleName, recordId);
    } else {
      return x;
    }
  };
}

/**
 * Logs Zoho Recruit server errors to the console, prefixed with the 'ZohoRecruit' service label.
 */
export const logZohoRecruitErrorToConsole = logZohoServerErrorFunction('ZohoRecruit');

/**
 * Parses the JSON body of a failed Zoho Recruit fetch response into a structured error, returning undefined if the body cannot be parsed.
 *
 * @param responseError - The fetch response error to parse
 * @returns Parsed Zoho server error, or undefined if parsing fails
 */
export async function parseZohoRecruitError(responseError: FetchResponseError) {
  const data: ZohoServerErrorResponseData | undefined = await responseError.response.json().catch(() => undefined);
  let result: ParsedZohoServerError | undefined;

  if (data) {
    result = parseZohoRecruitServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Converts raw Zoho Recruit error response data into a parsed error, delegating to Recruit-specific handlers for known error codes and falling back to the shared Zoho parser.
 *
 * @param errorResponseData - Raw error response data from the Zoho Recruit API
 * @param responseError - The underlying fetch response error
 * @returns Parsed Zoho server error, or undefined if the data contains no recognizable error
 */
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

/**
 * Intercepts Zoho Recruit API responses that return HTTP 200 but contain an error payload, re-throwing them as proper errors so callers are not silently misled by a success status.
 */
export const interceptZohoRecruit200StatusWithErrorResponse = interceptZohoErrorResponseFactory(parseZohoRecruitServerErrorResponseData);

/**
 * Wraps a fetch client to automatically parse Zoho Recruit error responses, log them, and invoke a custom handler (e.g., for token refresh on authentication failures).
 */
export const handleZohoRecruitErrorFetch = handleZohoErrorFetchFactory(parseZohoRecruitError, logZohoRecruitErrorToConsole);

// MARK: Compat
/**
 * @deprecated Use assertZohoRecruitRecordDataArrayResultHasContent instead.
 */
export const assertRecordDataArrayResultHasContent = assertZohoRecruitRecordDataArrayResultHasContent;
