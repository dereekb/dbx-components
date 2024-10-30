import { ConfiguredFetch, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

export interface ZohoServerErrorResponseData {
  readonly error: ZohoServerErrorData;
}

export type ZohoServerErrorCode = string;
export type ZohoServerErrorStatus = 'error';

export interface ZohoServerErrorData<T extends object = object> {
  readonly code: ZohoServerErrorCode;
  readonly details: T;
  readonly message: string;
  readonly status: ZohoServerErrorStatus;
}

export class ZohoServerError<D extends ZohoServerErrorData = ZohoServerErrorData> extends BaseError {
  get code() {
    return this.data.code;
  }

  constructor(readonly data: D, readonly responseError: FetchResponseError) {
    super(data.message);
  }

  get errorData(): object {
    return this.data;
  }
}

export type LogZohoServerErrorFunction = (error: ZohoServerError) => void;

/**
 * Creates a logZohoServerErrorFunction that logs the error to console.
 *
 * @param zohoApiNamePrefix Prefix to use when logging. I.E. ZohoRecruitError, etc.
 * @returns
 */
export function logZohoServerErrorFunction(zohoApiNamePrefix: string): LogZohoServerErrorFunction {
  return (error: ZohoServerError) => {
    console.log(`${zohoApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.errorData });
  };
}

/**
 * Wraps a ConfiguredFetch to support handling errors returned by fetch.
 *
 * @param fetch
 * @returns
 */
export type HandleZohoErrorFetchFactory = (fetch: ConfiguredFetch, logError?: LogZohoServerErrorFunction) => ConfiguredFetch;

export type ParseZohoFetchResponseErrorFunction = (responseError: FetchResponseError) => Promise<ZohoServerError | undefined>;

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
