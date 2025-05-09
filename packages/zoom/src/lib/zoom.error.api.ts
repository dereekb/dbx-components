import { MS_IN_MINUTE, Maybe, UnixDateTimeNumber } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonInterceptJsonResponseFunction, FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

export type ZoomServerErrorResponseDataError = ZoomServerErrorData | ZoomServerErrorCode;

export interface ZoomServerErrorResponseData {
  readonly error: ZoomServerErrorResponseDataError;
}

/**
 * A code used in some cases to denote success.
 */
export const ZOOM_SUCCESS_CODE = 'SUCCESS';

export type ZoomServerSuccessCode = typeof ZOOM_SUCCESS_CODE;
export type ZoomServerSuccessStatus = 'success';

export type ZoomServerErrorCode = string;
export type ZoomServerErrorStatus = 'error';

/**
 * Zoom Server Error Data
 *
 * Always contains a code and message. Details and status are optional.
 */
export interface ZoomServerErrorData<T = unknown> {
  readonly code: ZoomServerErrorCode;
  readonly message: string;
  readonly errors?: T;
  /**
   * Is sometimes present on some error responses.
   */
  readonly status?: ZoomServerErrorStatus;
}

/**
 * Contains details and a status
 */
export type ZoomServerErrorDataWithDetails<T = unknown> = Required<ZoomServerErrorData<T>>;

export function zoomServerErrorData(error: ZoomServerErrorResponseDataError): ZoomServerErrorData {
  const errorType = typeof error;
  let errorData: ZoomServerErrorData;

  if (errorType === 'object') {
    errorData = error as ZoomServerErrorData;
  } else {
    errorData = {
      code: error as ZoomServerErrorCode,
      message: ''
    };
  }

  return errorData;
}

/**
 * Zoom Server Error
 */
export class ZoomServerError<D extends ZoomServerErrorData = ZoomServerErrorData> extends BaseError {
  get code() {
    return this.error.code;
  }

  constructor(readonly error: D) {
    super(error.message);
  }
}

/**
 * Zoom Server Error that includes the FetchResponseError
 */
export class ZoomServerFetchResponseError<D extends ZoomServerErrorData = ZoomServerErrorData> extends ZoomServerError<D> {
  constructor(
    readonly data: D,
    readonly responseError: FetchResponseError
  ) {
    super(data);
  }
}

export type LogZoomServerErrorFunction = (error: FetchRequestFactoryError | ZoomServerError | ZoomServerFetchResponseError) => void;

/**
 * Creates a logZoomServerErrorFunction that logs the error to console.
 *
 * @param zoomApiNamePrefix Prefix to use when logging. I.E. ZoomError, etc.
 * @returns
 */
export function logZoomServerErrorFunction(zoomApiNamePrefix: string): LogZoomServerErrorFunction {
  return (error: FetchRequestFactoryError | ZoomServerError | ZoomServerFetchResponseError) => {
    if (error instanceof ZoomServerFetchResponseError) {
      console.log(`${zoomApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.data });
    } else if (error instanceof ZoomServerError) {
      console.log(`${zoomApiNamePrefix}Error(code:${error.code}): `, { error });
    } else {
      console.log(`${zoomApiNamePrefix}Error(name:${error.name}): `, { error });
    }
  };
}

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 *
 * @param fetch
 * @returns
 */
export type HandleZoomErrorFetchFactory = (fetch: ConfiguredFetch, logError?: LogZoomServerErrorFunction) => ConfiguredFetch;

export type ParsedZoomServerError = FetchRequestFactoryError | ZoomServerError | undefined;
export type ParseZoomFetchResponseErrorFunction = (responseError: FetchResponseError) => Promise<ParsedZoomServerError>;

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 *
 * @param fetch
 * @returns
 */
export function handleZoomErrorFetchFactory(parseZoomError: ParseZoomFetchResponseErrorFunction, defaultLogError: LogZoomServerErrorFunction): HandleZoomErrorFetchFactory {
  return (fetch: ConfiguredFetch, logError: LogZoomServerErrorFunction = defaultLogError) => {
    return async (x, y) => {
      try {
        return await fetch(x, y); // await to catch thrown errors
      } catch (e) {
        if (e instanceof FetchResponseError) {
          const error = await parseZoomError(e);

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

export type ParseZoomServerErrorResponseData = (zoomServerErrorResponseData: ZoomServerErrorResponseData, fetchResponseError: FetchResponseError) => ParsedZoomServerError;

/**
 * FetchJsonInterceptJsonResponseFunction that intercepts ZoomServerError responses and throws a ZoomServerError.
 *
 * @returns
 */
export function interceptZoomErrorResponseFactory(parseZoomServerErrorResponseData: ParseZoomServerErrorResponseData): FetchJsonInterceptJsonResponseFunction {
  return (json: ZoomServerErrorResponseData | unknown, response: Response) => {
    const error = (json as ZoomServerErrorResponseData)?.error;

    if (error != null) {
      const responseError = new FetchResponseError(response);

      if (responseError) {
        const parsedError = parseZoomServerErrorResponseData(json as ZoomServerErrorResponseData, responseError);

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
export const ZOOM_INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

/**
 * Error when the Zoom API returns an internal error
 */
export class ZoomInternalError extends ZoomServerFetchResponseError {}

/**
 * Error when too many requests are made in a short period of time.
 */
export const ZOOM_TOO_MANY_REQUESTS_ERROR_CODE = 'TOO_MANY_REQUESTS';

/**
 * The status code that Zoom uses to indicates that too many requests have been made in a short period of time.
 */
export const ZOOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE = 429;

export type ZoomRateLimitCategory = 'Light' | 'Medium' | 'Heavy';
export type ZoomRateLimitType = 'Per-second-limit' | 'Daily-limit';

export const ZOOM_RATE_LIMIT_CATEGORY_HEADER = 'X-RateLimit-Category';
export const ZOOM_RATE_LIMIT_TYPE_HEADER = 'X-RateLimit-Type';
export const ZOOM_RATE_LIMIT_LIMIT_HEADER = 'X-RateLimit-Limit';
export const ZOOM_RATE_LIMIT_REMAINING_HEADER = 'X-RateLimit-Remaining';
export const ZOOM_RATE_LIMIT_RETRY_AFTER_HEADER = 'Retry-After';

export const DEFAULT_ZOOM_API_RATE_LIMIT = 100;
export const DEFAULT_ZOOM_API_RATE_LIMIT_RESET_PERIOD = MS_IN_MINUTE;

export interface ZoomRateLimitHeaderDetails {
  /**
   * Total limit in a given period.
   */
  readonly limit: number;
  /**
   * Total number of remaining allowed requests.
   */
  readonly remaining: number;
  /**
   * The category of the rate limit.
   */
  readonly category: ZoomRateLimitCategory;
  /**
   * The type of the rate limit.
   */
  readonly type: ZoomRateLimitType;
  /**
   * The time at which the rate limit will reset.
   */
  readonly retryAfter: UnixDateTimeNumber;
  /**
   * The time at which the rate limit will reset.
   */
  readonly retryAfterAt: Date;
}

export function zoomRateLimitHeaderDetails(headers: Headers): Maybe<ZoomRateLimitHeaderDetails> {
  const limitHeader = headers.get(ZOOM_RATE_LIMIT_LIMIT_HEADER);
  const remainingHeader = headers.get(ZOOM_RATE_LIMIT_REMAINING_HEADER);
  const retryAfterHeader = headers.get(ZOOM_RATE_LIMIT_RETRY_AFTER_HEADER);
  const categoryHeader = headers.get(ZOOM_RATE_LIMIT_CATEGORY_HEADER);
  const typeHeader = headers.get(ZOOM_RATE_LIMIT_TYPE_HEADER);

  let result: Maybe<ZoomRateLimitHeaderDetails> = null;

  if (limitHeader != null && remainingHeader != null && retryAfterHeader != null) {
    const limit = Number(limitHeader);
    const remaining = Number(remainingHeader);
    const retryAfter = Number(retryAfterHeader);
    const retryAfterAt = new Date(retryAfter);
    const category = categoryHeader as ZoomRateLimitCategory;
    const type = typeHeader as ZoomRateLimitType;

    result = { limit, remaining, retryAfter, retryAfterAt, category, type };
  }

  return result;
}

export class ZoomTooManyRequestsError extends ZoomServerFetchResponseError {
  get headerDetails(): Maybe<ZoomRateLimitHeaderDetails> {
    return zoomRateLimitHeaderDetails(this.responseError.response.headers);
  }
}

/**
 * Function that parses/transforms a ZoomServerErrorResponseData into a general ZoomServerError or other known error type.
 *
 * @param errorResponseData
 * @param responseError
 * @returns
 */
export function parseZoomServerErrorResponseData(errorResponseData: ZoomServerErrorResponseData, responseError: FetchResponseError): ZoomServerFetchResponseError | undefined {
  let result: ZoomServerFetchResponseError | undefined;
  const error = tryFindZoomServerErrorData(errorResponseData, responseError);

  if (error) {
    const errorData = zoomServerErrorData(error);

    switch (errorData.code) {
      case ZOOM_INTERNAL_ERROR_CODE:
        result = new ZoomInternalError(errorData, responseError);
        break;
      case ZOOM_TOO_MANY_REQUESTS_ERROR_CODE:
        result = new ZoomTooManyRequestsError(errorData, responseError);
        break;
      default:
        result = new ZoomServerFetchResponseError(errorData, responseError);
        break;
    }
  }

  return result;
}

/**
 * Attempts to retrieve an ZoomServerErrorResponseDataError from the input.
 *
 * Non-200 errors returned by the Zoom API are returned as the object directly instead of as an ZoomServerErrorResponseData directly.
 *
 * @param errorResponseData
 * @param responseError
 * @returns
 */
export function tryFindZoomServerErrorData(errorResponseData: ZoomServerErrorResponseData | ZoomServerErrorResponseDataError, responseError: FetchResponseError): Maybe<ZoomServerErrorResponseDataError> {
  const error = (errorResponseData as ZoomServerErrorResponseData).error ?? (!responseError.response.ok ? (errorResponseData as unknown as ZoomServerErrorResponseDataError) : undefined);
  return error;
}
