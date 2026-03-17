import { type Maybe, MS_IN_SECOND } from '@dereekb/util';
import { type ConfiguredFetch, type FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

/**
 * Cal.com server error codes are numbers or strings.
 */
export type CalcomServerErrorCode = string | number;

/**
 * Cal.com Server Error Data
 *
 * Always contains a code and message. Details and status are optional.
 */
export interface CalcomServerErrorData<T = unknown> {
  readonly code: CalcomServerErrorCode;
  readonly message: string;
  readonly details?: T;
  /**
   * Is sometimes present on some error responses.
   */
  readonly status?: string;
}

/**
 * Cal.com Server Error
 */
export class CalcomServerError<D extends CalcomServerErrorData = CalcomServerErrorData> extends BaseError {
  get code() {
    return this.error.code;
  }

  constructor(readonly error: D) {
    super(error.message);
  }
}

/**
 * Cal.com Server Error that includes the FetchResponseError
 */
export class CalcomServerFetchResponseError<D extends CalcomServerErrorData = CalcomServerErrorData> extends CalcomServerError<D> {
  constructor(
    readonly data: D,
    readonly responseError: FetchResponseError
  ) {
    super(data);
  }
}

export type LogCalcomServerErrorFunction = (error: FetchRequestFactoryError | CalcomServerError | CalcomServerFetchResponseError) => void;

/**
 * Creates a logCalcomServerErrorFunction that logs the error to console.
 *
 * @param calcomApiNamePrefix Prefix to use when logging. I.E. CalcomError, etc.
 * @returns
 */
export function logCalcomServerErrorFunction(calcomApiNamePrefix: string): LogCalcomServerErrorFunction {
  return (error: FetchRequestFactoryError | CalcomServerError | CalcomServerFetchResponseError) => {
    if (error instanceof CalcomServerFetchResponseError) {
      console.log(`${calcomApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.data });
    } else if (error instanceof CalcomServerError) {
      console.log(`${calcomApiNamePrefix}Error(code:${error.code}): `, { error });
    } else {
      console.log(`${calcomApiNamePrefix}Error(name:${error.name}): `, { error });
    }
  };
}

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 */
export type HandleCalcomErrorFetchFactory = (fetch: ConfiguredFetch, logError?: LogCalcomServerErrorFunction) => ConfiguredFetch;

export type ParsedCalcomServerError = FetchRequestFactoryError | CalcomServerError | undefined;
export type ParseCalcomFetchResponseErrorFunction = (responseError: FetchResponseError) => Promise<ParsedCalcomServerError>;

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 */
export function handleCalcomErrorFetchFactory(parseCalcomError: ParseCalcomFetchResponseErrorFunction, defaultLogError: LogCalcomServerErrorFunction): HandleCalcomErrorFetchFactory {
  return (fetch: ConfiguredFetch, logError: LogCalcomServerErrorFunction = defaultLogError) => {
    return async (x, y) => {
      try {
        return await fetch(x, y); // await to catch thrown errors
      } catch (e) {
        if (e instanceof FetchResponseError) {
          const error = await parseCalcomError(e);

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
 * The status code that indicates too many requests have been made.
 */
export const CALCOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE = 429;

export const CALCOM_RATE_LIMIT_LIMIT_HEADER = 'X-RateLimit-Limit';
export const CALCOM_RATE_LIMIT_REMAINING_HEADER = 'X-RateLimit-Remaining';
export const CALCOM_RATE_LIMIT_RESET_HEADER = 'X-RateLimit-Reset';

export const DEFAULT_CALCOM_API_RATE_LIMIT = 100;
export const DEFAULT_CALCOM_API_RATE_LIMIT_RESET_PERIOD = 60 * MS_IN_SECOND;

export interface CalcomRateLimitHeaderDetails {
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
  readonly resetAt?: Date;
}

export function calcomRateLimitHeaderDetails(headers: Headers): Maybe<CalcomRateLimitHeaderDetails> {
  const limitHeader = headers.get(CALCOM_RATE_LIMIT_LIMIT_HEADER);
  const remainingHeader = headers.get(CALCOM_RATE_LIMIT_REMAINING_HEADER);
  const resetHeader = headers.get(CALCOM_RATE_LIMIT_RESET_HEADER);

  let result: Maybe<CalcomRateLimitHeaderDetails> = null;

  if (limitHeader != null || remainingHeader != null || resetHeader != null) {
    const limit = limitHeader ? Number(limitHeader) : undefined;
    const remaining = remainingHeader ? Number(remainingHeader) : undefined;
    const resetAt = resetHeader ? new Date(Number(resetHeader) * MS_IN_SECOND) : undefined;

    result = { limit, remaining, resetAt };
  }

  return result;
}

export class CalcomTooManyRequestsError extends CalcomServerFetchResponseError {
  get headerDetails(): Maybe<CalcomRateLimitHeaderDetails> {
    return calcomRateLimitHeaderDetails(this.responseError.response.headers);
  }
}

/**
 * Function that parses/transforms a CalcomServerErrorData into a general CalcomServerError or other known error type.
 */
export function parseCalcomServerErrorData(calcomServerError: CalcomServerErrorData, responseError: FetchResponseError): CalcomServerFetchResponseError | undefined {
  let result: CalcomServerFetchResponseError | undefined;

  if (responseError.response.status === CALCOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
    result = new CalcomTooManyRequestsError(calcomServerError, responseError);

    console.warn('CalcomTooManyRequestsError', {
      result,
      responseError,
      headerDetails: (result as CalcomTooManyRequestsError).headerDetails
    });
  } else if (calcomServerError) {
    switch (calcomServerError.code) {
      default:
        result = new CalcomServerFetchResponseError(calcomServerError, responseError);
        break;
    }
  }

  return result;
}
