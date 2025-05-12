import { ArrayOrValue, MS_IN_MINUTE, MS_IN_SECOND, Maybe, UnixDateTimeNumber, asArray } from '@dereekb/util';
import { ConfiguredFetch, FetchRequestFactoryError, FetchResponseError, MakeUrlSearchParamsOptions, mergeMakeUrlSearchParamsOptions } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

/**
 * A code used in some cases to denote success.
 */
export const ZOOM_SUCCESS_CODE = 'SUCCESS';

export type ZoomServerSuccessCode = typeof ZOOM_SUCCESS_CODE;
export type ZoomServerSuccessStatus = 'success';

export type ZoomServerErrorStatus = 'error';

/**
 * Zoom server error codes are numbers or strings.
 *
 * Check the API docs for specific functions to see what codes are used for what error.
 */
export type ZoomServerErrorCode = string | number;

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

// MARK: Parsed Errors
/**
 * The status code that Zoom uses to indicates that too many requests have been made in a short period of time.
 */
export const ZOOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE = 429;

/**
 * Also shares the same 429 code as ZOOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE.
 */
export const ZOOM_TOO_MANY_REQUESTS_ERROR_CODE = 429;

export type ZoomRateLimitCategory = 'Light' | 'Medium' | 'Heavy';

/**
 * QPS - Queries per second
 */
export type ZoomRateLimitType = 'QPS' | 'Per-second-limit' | 'Daily-limit';

export const ZOOM_RATE_LIMIT_CATEGORY_HEADER = 'X-RateLimit-Category';
export const ZOOM_RATE_LIMIT_TYPE_HEADER = 'X-RateLimit-Type';
export const ZOOM_RATE_LIMIT_LIMIT_HEADER = 'X-RateLimit-Limit';
export const ZOOM_RATE_LIMIT_REMAINING_HEADER = 'X-RateLimit-Remaining';
export const ZOOM_RATE_LIMIT_RETRY_AFTER_HEADER = 'Retry-After';

export const DEFAULT_ZOOM_API_RATE_LIMIT = 2;
export const DEFAULT_ZOOM_API_RATE_LIMIT_RESET_PERIOD = MS_IN_SECOND;

export interface ZoomRateLimitHeaderDetails {
  /**
   * The category of the rate limit.
   */
  readonly category: ZoomRateLimitCategory;
  /**
   * The type of the rate limit.
   */
  readonly type: ZoomRateLimitType;
  /**
   * Total limit in a given period.
   */
  readonly limit?: number;
  /**
   * Total number of remaining allowed requests.
   */
  readonly remaining?: number;
  /**
   * The time at which the rate limit will reset.
   */
  readonly retryAfter?: UnixDateTimeNumber;
  /**
   * The time at which the rate limit will reset.
   */
  readonly retryAfterAt?: Date;
}

export function zoomRateLimitHeaderDetails(headers: Headers): Maybe<ZoomRateLimitHeaderDetails> {
  const limitHeader = headers.get(ZOOM_RATE_LIMIT_LIMIT_HEADER);
  const remainingHeader = headers.get(ZOOM_RATE_LIMIT_REMAINING_HEADER);
  const retryAfterHeader = headers.get(ZOOM_RATE_LIMIT_RETRY_AFTER_HEADER);
  const categoryHeader = headers.get(ZOOM_RATE_LIMIT_CATEGORY_HEADER);
  const typeHeader = headers.get(ZOOM_RATE_LIMIT_TYPE_HEADER);

  let result: Maybe<ZoomRateLimitHeaderDetails> = null;

  if (categoryHeader != null && typeHeader != null) {
    const category = categoryHeader as ZoomRateLimitCategory;
    const type = typeHeader as ZoomRateLimitType;
    const limit = limitHeader ? Number(limitHeader) : undefined;
    const remaining = remainingHeader ? Number(remainingHeader) : undefined;
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    const retryAfterAt = retryAfterHeader ? new Date(retryAfterHeader) : undefined;

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
 * Function that parses/transforms a ZoomServerErrorData into a general ZoomServerError or other known error type.
 *
 * @param errorResponseData
 * @param responseError
 * @returns
 */
export function parseZoomServerErrorData(zoomServerError: ZoomServerErrorData, responseError: FetchResponseError): ZoomServerFetchResponseError | undefined {
  let result: ZoomServerFetchResponseError | undefined;

  if (responseError.response.status === ZOOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
    result = new ZoomTooManyRequestsError(zoomServerError, responseError);

    console.warn('ZoomTooManyRequestsError', {
      result,
      responseError,
      headerDetails: (result as ZoomTooManyRequestsError).headerDetails
    });
  } else if (zoomServerError) {
    switch (zoomServerError.code) {
      default:
        result = new ZoomServerFetchResponseError(zoomServerError, responseError);
        break;
    }
  }

  return result;
}

// MARK: Silence
export interface SilenceZoomErrorConfig {
  /**
   * If true an error will be thrown if the meeting does not exist.
   */
  readonly silenceError?: boolean;
}

/**
 * Returns a pre-configured MakeUrlSearchParamsOptions that omits the silenceError key.
 *
 * If other options are input, it merges those two options together and adds silenceError to the omitted keys.
 */
export function omitSilenceZoomErrorKeys(options?: MakeUrlSearchParamsOptions): MakeUrlSearchParamsOptions {
  const omitKeys = ['silenceError'];
  return mergeMakeUrlSearchParamsOptions([options, { omitKeys }]);
}

export type SilenceZoomErrorWithCodesFunction<T> = (silence?: boolean) => (reason: unknown) => T;

/**
 * Used with catch() to silence Zoom errors with the specified codes.
 *
 * For example, when deleting a meeting that does not exist, the error code is 3001. This function can be used to silence that error.
 */
export function silenceZoomErrorWithCodesFunction<T>(codes: ArrayOrValue<ZoomServerErrorCode>): SilenceZoomErrorWithCodesFunction<void>;
export function silenceZoomErrorWithCodesFunction<T>(codes: ArrayOrValue<ZoomServerErrorCode>, returnFn: (error: ZoomServerFetchResponseError) => T): SilenceZoomErrorWithCodesFunction<T>;
export function silenceZoomErrorWithCodesFunction<T>(codes: ArrayOrValue<ZoomServerErrorCode>, returnFn?: (error: ZoomServerFetchResponseError) => T): SilenceZoomErrorWithCodesFunction<T> {
  const codesSet = new Set(asArray(codes));

  return (silence?: boolean) => {
    return (reason: unknown) => {
      if (silence !== false && reason instanceof ZoomServerFetchResponseError) {
        if (codesSet.has(reason.code)) {
          return returnFn?.(reason) as any;
        }
      }

      throw reason;
    };
  };
}
