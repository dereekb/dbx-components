import { MS_IN_MINUTE, type Maybe, type UnixDateTimeNumber } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonInterceptJsonResponseFunction, type FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { error } from 'console';
import { BaseError } from 'make-error';

/**
 * Returned by Zoho CRM.
 *
 * The data array contains the list of possible success
 */
export interface ZohoServerErrorResponseDataArrayRef {
  readonly data: ZohoServerErrorResponseDataArrayElement[];
}

/**
 * Array of response elements that may contain either a success or error.
 */
export type ZohoServerErrorResponseDataArrayElement = ZohoServerErrorData | ZohoServerSuccessData;

/**
 * Default place-holder used by the ZohoServerFetchResponseDataArrayError class.
 */
export const ZOHO_DATA_ARRAY_BLANK_ERROR_CODE = '__internal_data_array_blank_error';

/**
 * Returns true if the input value is a ZohoServerErrorResponseDataArrayRef.
 *
 * @param value
 * @returns
 */
export function isZohoServerErrorResponseDataArrayRef(value: unknown): value is ZohoServerErrorResponseDataArrayRef {
  return Array.isArray((value as ZohoServerErrorResponseDataArrayRef)?.data);
}

/**
 * Returned by Zoho Recruit.
 */
export type ZohoServerErrorResponseDataError = ZohoServerErrorData | ZohoServerErrorCode;

/**
 * Returned by Zoho Recruit.
 */
export interface ZohoServerErrorResponseData {
  readonly error: ZohoServerErrorResponseDataError;
}

/**
 * A code used in some cases to denote success.
 */
export const ZOHO_SUCCESS_CODE = 'SUCCESS';

/**
 * Lowercase status code
 */
export const ZOHO_SUCCESS_STATUS = 'success';

/**
 * Set in the status field
 */
export const ZOHO_ERROR_STATUS = 'error';

export type ZohoServerSuccessCode = typeof ZOHO_SUCCESS_CODE;
export type ZohoServerSuccessStatus = typeof ZOHO_SUCCESS_STATUS;

export type ZohoServerErrorCode = string;
export type ZohoServerErrorStatus = typeof ZOHO_ERROR_STATUS;

/**
 * Zoho Server Error Data
 *
 * Always contains a code and message. Details and status are optional.
 */
export interface ZohoServerErrorData<T = unknown> {
  readonly code: ZohoServerErrorCode;
  readonly message: string;
  readonly details?: T;
  /**
   * Is sometimes present on some error responses.
   */
  readonly status?: ZohoServerErrorStatus;
}

/**
 * Zoho Server Success Data
 *
 * Always contains a code and message. Details and status are optional.
 */
export type ZohoServerSuccessData<T = unknown> = Omit<ZohoServerErrorData<T>, 'code'> & {
  readonly code: ZohoServerSuccessCode;
};

/**
 * Contains details and a status
 */
export type ZohoServerErrorDataWithDetails<T = unknown> = Required<ZohoServerErrorData<T>>;

export function zohoServerErrorData(error: ZohoServerErrorResponseDataError): ZohoServerErrorData {
  const errorType = typeof error;
  let errorData: ZohoServerErrorData;

  if (errorType === 'object') {
    errorData = error as ZohoServerErrorData;
  } else {
    errorData = {
      code: error as ZohoServerErrorCode,
      message: ''
    };
  }

  return errorData;
}

/**
 * Zoho Server Error
 */
export class ZohoServerError<D extends ZohoServerErrorData = ZohoServerErrorData> extends BaseError {
  get code() {
    return this.error.code;
  }

  constructor(readonly error: D) {
    super(error.message);
  }
}

/**
 * Zoho Server Error that includes the FetchResponseError
 */
export class ZohoServerFetchResponseError<D extends ZohoServerErrorData = ZohoServerErrorData> extends ZohoServerError<D> {
  constructor(
    readonly data: D,
    readonly errorResponseData: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef,
    readonly responseError: FetchResponseError
  ) {
    super(data);
  }
}

/**
 * Zoho Server Error that includes the FetchResponseError
 */
export class ZohoServerFetchResponseDataArrayError extends ZohoServerFetchResponseError<ZohoServerErrorData> {
  constructor(errorResponseData: ZohoServerErrorResponseDataArrayRef, responseError: FetchResponseError) {
    super({ code: ZOHO_DATA_ARRAY_BLANK_ERROR_CODE, message: 'Check data for individual errors.' }, errorResponseData, responseError);
  }

  get errorDataArray() {
    return (this.errorResponseData as ZohoServerErrorResponseDataArrayRef).data;
  }
}

export type LogZohoServerErrorFunction = (error: FetchRequestFactoryError | ZohoServerError | ZohoServerFetchResponseError) => void;

/**
 * Creates a logZohoServerErrorFunction that logs the error to console.
 *
 * @param zohoApiNamePrefix Prefix to use when logging. I.E. ZohoRecruitError, etc.
 * @returns
 */
export function logZohoServerErrorFunction(zohoApiNamePrefix: string): LogZohoServerErrorFunction {
  return (error: FetchRequestFactoryError | ZohoServerError | ZohoServerFetchResponseError) => {
    if (error instanceof ZohoServerFetchResponseError) {
      console.log(`${zohoApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.data });
    } else if (error instanceof ZohoServerError) {
      console.log(`${zohoApiNamePrefix}Error(code:${error.code}): `, { error });
    } else {
      console.log(`${zohoApiNamePrefix}Error(name:${error.name}): `, { error });
    }
  };
}

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 *
 * @param fetch
 * @returns
 */
export type HandleZohoErrorFetchFactory = (fetch: ConfiguredFetch, logError?: LogZohoServerErrorFunction, onError?: (error: ParsedZohoServerError) => void) => ConfiguredFetch;

export type ParsedZohoServerError = FetchRequestFactoryError | ZohoServerError | undefined;
export type ParseZohoFetchResponseErrorFunction = (responseError: FetchResponseError) => Promise<ParsedZohoServerError>;

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 *
 * @param fetch
 * @returns
 */
export function handleZohoErrorFetchFactory(parseZohoError: ParseZohoFetchResponseErrorFunction, defaultLogError: LogZohoServerErrorFunction): HandleZohoErrorFetchFactory {
  return (fetch: ConfiguredFetch, logError: LogZohoServerErrorFunction = defaultLogError, onError?: (error: ParsedZohoServerError) => void) => {
    return async (x, y) => {
      try {
        return await fetch(x, y); // await to catch thrown errors
      } catch (e) {
        if (e instanceof FetchResponseError) {
          const error = await parseZohoError(e);

          if (error) {
            logError(error); // log before throwing.
            onError?.(error); // perform a task
            throw error;
          }
        }

        throw e;
      }
    };
  };
}

export type ParseZohoServerErrorResponseData = (zohoServerErrorResponseData: ZohoServerErrorResponseData, fetchResponseError: FetchResponseError) => ParsedZohoServerError;

/**
 * FetchJsonInterceptJsonResponseFunction that intercepts a 200 response that actually contains a ZohoServerError and throws a ZohoServerError for the error handling to catch.
 */
export function interceptZohoErrorResponseFactory(parseZohoServerErrorResponseData: ParseZohoServerErrorResponseData): FetchJsonInterceptJsonResponseFunction {
  return (json: ZohoServerErrorResponseData | unknown, response: Response) => {
    const error = (json as ZohoServerErrorResponseData)?.error;

    if (error != null) {
      const responseError = new FetchResponseError(response);

      if (responseError) {
        const parsedError = parseZohoServerErrorResponseData(json as ZohoServerErrorResponseData, responseError);

        if (parsedError) {
          throw parsedError;
        }
      }
    }

    return json;
  };
}

// MARK: Parsed Errors
/**
 * Error in the following (but not limited to) cases:
 * - An extra parameter is provided
 */
export const ZOHO_INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

/**
 * Error code for when an invalid oauth token is provided.
 */
export const ZOHO_INVALID_TOKEN_ERROR_CODE = 'INVALID_TOKEN';

export class ZohoInvalidTokenError extends ZohoServerFetchResponseError {}

/**
 * Error code for when a failure occured for the given action
 */
export const ZOHO_FAILURE_ERROR_CODE = 'FAILURE';

/**
 * Error when the Zoho API returns an internal error
 */
export class ZohoInternalError extends ZohoServerFetchResponseError {}

/**
 * Error in the following cases:
 * - Authorization is not properly constructed ("Invalid Ticket Id")
 * - OAuth token is expired ("Invalid OAuthtoken")
 */
export const ZOHO_INVALID_AUTHORIZATION_ERROR_CODE = '4834';

/**
 * Error when the Zoho API returns an invalid authorization error code.
 */
export class ZohoInvalidAuthorizationError extends ZohoServerFetchResponseError {}

/**
 * Error in the following cases:
 * - Search query is invalid
 */
export const ZOHO_INVALID_QUERY_ERROR_CODE = 'INVALID_QUERY';

export interface ZohoInvalidQueryErrorDetails {
  readonly reason: string;
  readonly api_name: string;
  readonly operator: string;
}

export class ZohoInvalidQueryError extends ZohoServerFetchResponseError {
  get details() {
    return this.error.details as ZohoInvalidQueryErrorDetails;
  }
}

/**
 * Error when a mandatory field is missing.
 */
export const ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE = 'MANDATORY_NOT_FOUND';

/**
 * Error when a duplicate record is found with a matching unique field value.
 */
export const ZOHO_DUPLICATE_DATA_ERROR_CODE = 'DUPLICATE_DATA';

/**
 * Error when some passed data is invalid.
 */
export const ZOHO_INVALID_DATA_ERROR_CODE = 'INVALID_DATA';

/**
 * Error when too many requests are made in a short period of time.
 */
export const ZOHO_TOO_MANY_REQUESTS_ERROR_CODE = 'TOO_MANY_REQUESTS';

/**
 * The status code that Zoho uses to indicates that too many requests have been made in a short period of time.
 */
export const ZOHO_TOO_MANY_REQUESTS_HTTP_STATUS_CODE = 429;

export const ZOHO_RATE_LIMIT_LIMIT_HEADER = 'X-RATELIMIT-LIMIT';
export const ZOHO_RATE_LIMIT_REMAINING_HEADER = 'X-RATELIMIT-REMAINING';
export const ZOHO_RATE_LIMIT_RESET_HEADER = 'X-RATELIMIT-RESET';

export const DEFAULT_ZOHO_API_RATE_LIMIT = 100;
export const DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD = MS_IN_MINUTE;

export interface ZohoRateLimitHeaderDetails {
  /**
   * Total limit in a given period.
   */
  readonly limit: number;
  /**
   * Total number of remaining allowed requests.
   */
  readonly remaining: number;
  /**
   * The time at which the rate limit will reset.
   */
  readonly reset: UnixDateTimeNumber;
  /**
   * The time at which the rate limit will reset.
   */
  readonly resetAt: Date;
}

export function zohoRateLimitHeaderDetails(headers: Headers): Maybe<ZohoRateLimitHeaderDetails> {
  const limitHeader = headers.get(ZOHO_RATE_LIMIT_LIMIT_HEADER);
  const remainingHeader = headers.get(ZOHO_RATE_LIMIT_REMAINING_HEADER);
  const resetHeader = headers.get(ZOHO_RATE_LIMIT_RESET_HEADER);

  let result: Maybe<ZohoRateLimitHeaderDetails> = null;

  if (limitHeader != null && remainingHeader != null && resetHeader != null) {
    const limit = Number(limitHeader);
    const remaining = Number(remainingHeader);
    const reset = Number(resetHeader);
    const resetAt = new Date(reset);

    result = { limit, remaining, reset, resetAt };
  }

  return result;
}

export class ZohoTooManyRequestsError extends ZohoServerFetchResponseError {
  get headerDetails(): Maybe<ZohoRateLimitHeaderDetails> {
    return zohoRateLimitHeaderDetails(this.responseError.response.headers);
  }
}

/**
 * Function that parses/transforms a ZohoServerErrorResponseData into a general ZohoServerError or other known error type.
 *
 * @param errorResponseData
 * @param responseError
 * @returns
 */
export function parseZohoServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData | ZohoServerErrorResponseDataArrayRef, responseError: FetchResponseError): ZohoServerFetchResponseError | undefined {
  let result: ZohoServerFetchResponseError | undefined;

  if (isZohoServerErrorResponseDataArrayRef(errorResponseData)) {
    result = new ZohoServerFetchResponseDataArrayError(errorResponseData, responseError);
  } else {
    const error = tryFindZohoServerErrorData(errorResponseData, responseError);

    if (error) {
      const errorData = zohoServerErrorData(error);

      switch (errorData.code) {
        case ZOHO_INTERNAL_ERROR_CODE:
          result = new ZohoInternalError(errorData, errorResponseData, responseError);
          break;
        case ZOHO_INVALID_TOKEN_ERROR_CODE:
          result = new ZohoInvalidTokenError(errorData, errorResponseData, responseError);
          break;
        case ZOHO_INVALID_AUTHORIZATION_ERROR_CODE:
          result = new ZohoInvalidAuthorizationError(errorData, errorResponseData, responseError);
          break;
        case ZOHO_INVALID_QUERY_ERROR_CODE:
          result = new ZohoInvalidQueryError(errorData, errorResponseData, responseError);
          break;
        case ZOHO_TOO_MANY_REQUESTS_ERROR_CODE:
          result = new ZohoTooManyRequestsError(errorData, errorResponseData, responseError);
          break;
        default:
          result = new ZohoServerFetchResponseError(errorData, errorResponseData, responseError);
          break;
      }
    }
  }

  return result;
}

/**
 * Attempts to retrieve an ZohoServerErrorResponseDataError from the input.
 *
 * Non-200 errors returned by the Zoho API are returned as the object directly instead of as an ZohoServerErrorResponseData directly.
 * Zoho CRM returns a ZohoServerErrorResponseDataArrayRef value for errors.
 *
 * @param errorResponseData
 * @param responseError
 * @returns
 */
export function tryFindZohoServerErrorData(errorResponseData: ZohoServerErrorResponseDataArrayRef | ZohoServerErrorResponseData | ZohoServerErrorResponseDataError, responseError: FetchResponseError): Maybe<ZohoServerErrorResponseDataError> {
  const error = (errorResponseData as ZohoServerErrorResponseData).error ?? (errorResponseData as ZohoServerErrorResponseDataArrayRef).data?.[0] ?? (!responseError.response.ok ? (errorResponseData as unknown as ZohoServerErrorResponseDataError) : undefined);
  return error;
}
