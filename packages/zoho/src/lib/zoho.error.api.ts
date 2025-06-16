import { MS_IN_MINUTE, Maybe, UnixDateTimeNumber } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonInterceptJsonResponseFunction, FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

export type ZohoServerErrorResponseDataError = ZohoServerErrorData | ZohoServerErrorCode;

export interface ZohoServerErrorResponseData {
  readonly error: ZohoServerErrorResponseDataError;
}

/**
 * A code used in some cases to denote success.
 */
export const ZOHO_SUCCESS_CODE = 'SUCCESS';

export type ZohoServerSuccessCode = typeof ZOHO_SUCCESS_CODE;
export type ZohoServerSuccessStatus = 'success';

export type ZohoServerErrorCode = string;
export type ZohoServerErrorStatus = 'error';

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
    readonly responseError: FetchResponseError
  ) {
    super(data);
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
export type HandleZohoErrorFetchFactory = (fetch: ConfiguredFetch, logError?: LogZohoServerErrorFunction) => ConfiguredFetch;

export type ParsedZohoServerError = FetchRequestFactoryError | ZohoServerError | undefined;
export type ParseZohoFetchResponseErrorFunction = (responseError: FetchResponseError) => Promise<ParsedZohoServerError>;

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 *
 * @param fetch
 * @returns
 */
export function handleZohoErrorFetchFactory(parseZohoError: ParseZohoFetchResponseErrorFunction, defaultLogError: LogZohoServerErrorFunction): HandleZohoErrorFetchFactory {
  return (fetch: ConfiguredFetch, logError: LogZohoServerErrorFunction = defaultLogError) => {
    return async (x, y) => {
      try {
        return await fetch(x, y); // await to catch thrown errors
      } catch (e) {
        if (e instanceof FetchResponseError) {
          const error = await parseZohoError(e);

          if (error) {
            logError(error); // log before throwing.
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
export function parseZohoServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError): ZohoServerFetchResponseError | undefined {
  let result: ZohoServerFetchResponseError | undefined;
  const error = tryFindZohoServerErrorData(errorResponseData, responseError);

  if (error) {
    const errorData = zohoServerErrorData(error);

    switch (errorData.code) {
      case ZOHO_INTERNAL_ERROR_CODE:
        result = new ZohoInternalError(errorData, responseError);
        break;
      case ZOHO_INVALID_AUTHORIZATION_ERROR_CODE:
        result = new ZohoInvalidAuthorizationError(errorData, responseError);
        break;
      case ZOHO_INVALID_QUERY_ERROR_CODE:
        result = new ZohoInvalidQueryError(errorData, responseError);
        break;
      case ZOHO_TOO_MANY_REQUESTS_ERROR_CODE:
        result = new ZohoTooManyRequestsError(errorData, responseError);
        break;
      default:
        result = new ZohoServerFetchResponseError(errorData, responseError);
        break;
    }
  }

  return result;
}

/**
 * Attempts to retrieve an ZohoServerErrorResponseDataError from the input.
 *
 * Non-200 errors returned by the Zoho API are returned as the object directly instead of as an ZohoServerErrorResponseData directly.
 *
 * @param errorResponseData
 * @param responseError
 * @returns
 */
export function tryFindZohoServerErrorData(errorResponseData: ZohoServerErrorResponseData | ZohoServerErrorResponseDataError, responseError: FetchResponseError): Maybe<ZohoServerErrorResponseDataError> {
  const error = (errorResponseData as ZohoServerErrorResponseData).error ?? (!responseError.response.ok ? (errorResponseData as unknown as ZohoServerErrorResponseDataError) : undefined);
  return error;
}
