import { Maybe } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonInterceptJsonResponseFunction, FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

export type ZohoServerErrorResponseDataError = ZohoServerErrorData | ZohoServerErrorCode;

export interface ZohoServerErrorResponseData {
  readonly error: ZohoServerErrorResponseDataError;
}

export type ZohoServerErrorCode = string;
export type ZohoServerErrorStatus = 'error';

export interface ZohoServerErrorData {
  readonly code: ZohoServerErrorCode;
  readonly message: string;
}

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

export type ParseZohoRecruitServerErrorResponseData = (zohoServerErrorResponseData: ZohoServerErrorResponseData, fetchResponseError: FetchResponseError) => ZohoServerError | undefined;

/**
 * FetchJsonInterceptJsonResponseFunction that intercepts ZohoServerError responses and throws a ZohoServerError.
 *
 * @returns
 */
export function interceptZohoErrorResponseFactory(parseZohoRecruitServerErrorResponseData: ParseZohoRecruitServerErrorResponseData): FetchJsonInterceptJsonResponseFunction {
  return (json: ZohoServerErrorResponseData | unknown, response: Response) => {
    const error = (json as ZohoServerErrorResponseData)?.error;

    if (error != null) {
      const responseError = new FetchResponseError(response);

      if (responseError) {
        const parsedError = parseZohoRecruitServerErrorResponseData(json as ZohoServerErrorResponseData, responseError);

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
 * Thrown in the following (but not limited to) cases:
 * - An extra parameter is provided
 */
const ZOHO_INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

/**
 * Thrown when the Zoho API returns an internal error
 */
export class ZohoInternalError extends ZohoServerError {}

/**
 * Thrown in the following cases:
 * - Authorization is not properly constructed ("Invalid Ticket Id")
 * - OAuth token is expired ("Invalid OAuthtoken")
 */
const ZOHO_INVALID_AUTHORIZATION_ERROR_CODE = '4834';

/**
 * Thrown when the Zoho API returns an invalid authorization error code.
 */
export class ZohoInvalidAuthorizationError extends ZohoServerError {}

/**
 * Function that parses/transforms a ZohoServerErrorResponseData into a general ZohoServerError or other known error type.
 *
 * @param errorResponseData
 * @param responseError
 * @returns
 */
export function parseZohoServerErrorResponseData(errorResponseData: ZohoServerErrorResponseData, responseError: FetchResponseError): ZohoServerError | undefined {
  let result: ZohoServerError | undefined;
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
      default:
        result = new ZohoServerError(errorData, responseError);
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
