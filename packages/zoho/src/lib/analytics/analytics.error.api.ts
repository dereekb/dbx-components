import { type Maybe } from '@dereekb/util';
import { type FetchJsonInterceptJsonResponseFunction, FetchResponseError } from '@dereekb/util/fetch';
import { type ParsedZohoServerError, type ZohoServerErrorData, type ZohoServerErrorResponseData, ZohoInvalidTokenError, ZohoServerFetchResponseError, ZohoTooManyRequestsError, handleZohoErrorFetchFactory, logZohoServerErrorFunction, parseZohoServerErrorResponseData } from '../zoho.error.api';

// MARK: Response Envelope
/**
 * Value of the `status` field on a successful Zoho Analytics response.
 */
export const ZOHO_ANALYTICS_SUCCESS_STATUS = 'success';

/**
 * Value of the `status` field on a failed Zoho Analytics response.
 */
export const ZOHO_ANALYTICS_FAILURE_STATUS = 'failure';

/**
 * Numeric error code returned by the Zoho Analytics API.
 *
 * Analytics identifies errors with numbers (e.g. `8535`) rather than the symbolic string codes
 * (e.g. `'INVALID_TOKEN'`) used by CRM, Recruit, Desk and Sign.
 */
export type ZohoAnalyticsErrorCode = number | string;

/**
 * The error payload nested under `data` on a failed Zoho Analytics response.
 */
export interface ZohoAnalyticsErrorResponseDataError {
  readonly errorCode?: Maybe<ZohoAnalyticsErrorCode>;
  readonly errorMessage?: Maybe<string>;
}

/**
 * Error response returned by the Zoho Analytics API.
 *
 * Analytics uses its own envelope rather than the `{ error }` / `{ data: [] }` shapes returned by
 * the other Zoho services:
 *
 * ```json
 * {"status":"failure","summary":"META_DBNAME_DUPLICATE",
 *  "data":{"errorCode":7101,"errorMessage":"Workspace with the same name exists already"}}
 * ```
 *
 * @see https://www.zoho.com/analytics/api/v2/api-specification.html
 */
export interface ZohoAnalyticsErrorResponseData {
  readonly status?: Maybe<string>;
  /**
   * Symbolic constant naming the failure, e.g. `'META_DBNAME_DUPLICATE'`.
   */
  readonly summary?: Maybe<string>;
  readonly data?: Maybe<ZohoAnalyticsErrorResponseDataError>;
}

/**
 * Extra detail attached to a parsed Zoho Analytics error.
 */
export interface ZohoAnalyticsServerErrorDetails {
  /**
   * The `summary` constant from the Analytics error envelope.
   */
  readonly summary?: Maybe<string>;
}

// MARK: Error Codes
/**
 * Error code returned when the provided OAuth token is invalid or expired.
 *
 * Mapped to {@link ZohoInvalidTokenError} so that the Analytics fetch wrapper clears the cached
 * access token and the next request retrieves a fresh one.
 *
 * @see https://www.zoho.com/analytics/api/v2/common-error-codes.html
 */
export const ZOHO_ANALYTICS_INVALID_OAUTH_TOKEN_ERROR_CODE = '8535';

/**
 * Error code returned when the `ZANALYTICS-ORGID` header is missing from the request.
 *
 * @see https://www.zoho.com/analytics/api/v2/common-error-codes.html
 */
export const ZOHO_ANALYTICS_ORG_ID_NOT_PRESENT_ERROR_CODE = '8083';

/**
 * Error code returned when the per-minute API frequency limit is exceeded.
 *
 * Analytics allows 100 requests per minute overall (40/min for bulk operations, 60/min for
 * metadata).
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-frequency.html
 */
export const ZOHO_ANALYTICS_FREQUENCY_LIMIT_ERROR_CODE = '6045';

/**
 * Error codes returned when the plan's daily API unit quota is exhausted.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-units.html
 */
export const ZOHO_ANALYTICS_DAILY_UNIT_LIMIT_ERROR_CODES = ['6043', '6044'];

/**
 * Error raised when a Zoho Analytics request omits the required organization id header.
 *
 * Indicates the `ZohoAnalyticsConfig` is missing its `orgId`.
 */
export class ZohoAnalyticsMissingOrgIdError extends ZohoServerFetchResponseError {}

// MARK: Parsing
/**
 * Returns true when the input looks like a failed Zoho Analytics response envelope.
 *
 * @param value - A parsed JSON response body.
 * @returns Whether the body is an Analytics failure envelope.
 */
export function isZohoAnalyticsErrorResponseData(value: unknown): value is ZohoAnalyticsErrorResponseData {
  return (value as ZohoAnalyticsErrorResponseData)?.status === ZOHO_ANALYTICS_FAILURE_STATUS;
}

/**
 * Normalizes a Zoho Analytics error envelope into the shared {@link ZohoServerErrorData} shape,
 * stringifying the numeric error code so it can be compared against the shared string codes.
 *
 * @param errorResponseData - The Analytics failure envelope.
 * @returns Normalized error data with code, message and the originating summary as details.
 */
export function zohoAnalyticsServerErrorData(errorResponseData: ZohoAnalyticsErrorResponseData): ZohoServerErrorData<ZohoAnalyticsServerErrorDetails> {
  const { summary, data } = errorResponseData;
  const errorCode = data?.errorCode;

  return {
    code: errorCode == null ? (summary ?? '') : String(errorCode),
    message: data?.errorMessage ?? summary ?? '',
    details: { summary }
  };
}

/**
 * Parses a Zoho Analytics response body into a typed error.
 *
 * Analytics error codes are numeric and unrelated to the symbolic codes the shared parser knows,
 * so the Analytics-specific codes are classified here. Bodies that are not Analytics failure
 * envelopes fall through to the shared parser, which covers errors raised upstream of Analytics
 * (for example by Zoho Accounts during a token exchange).
 *
 * @param errorResponseData - The raw response body from the Zoho Analytics API.
 * @param responseError - The original fetch response error for context.
 * @returns The parsed Zoho server error, or undefined if the error could not be classified.
 */
export function parseZohoAnalyticsServerErrorResponseData(errorResponseData: unknown, responseError: FetchResponseError): ParsedZohoServerError {
  let result: ParsedZohoServerError;

  if (isZohoAnalyticsErrorResponseData(errorResponseData)) {
    const errorData = zohoAnalyticsServerErrorData(errorResponseData);
    // the shared error classes expect a { error } envelope, so adapt to it
    const responseData: ZohoServerErrorResponseData = { error: errorData };

    switch (errorData.code) {
      case ZOHO_ANALYTICS_INVALID_OAUTH_TOKEN_ERROR_CODE:
        result = new ZohoInvalidTokenError(errorData, responseData, responseError);
        break;
      case ZOHO_ANALYTICS_ORG_ID_NOT_PRESENT_ERROR_CODE:
        result = new ZohoAnalyticsMissingOrgIdError(errorData, responseData, responseError);
        break;
      case ZOHO_ANALYTICS_FREQUENCY_LIMIT_ERROR_CODE:
        result = new ZohoTooManyRequestsError(errorData, responseData, responseError);
        break;
      default:
        result = ZOHO_ANALYTICS_DAILY_UNIT_LIMIT_ERROR_CODES.includes(errorData.code) ? new ZohoTooManyRequestsError(errorData, responseData, responseError) : new ZohoServerFetchResponseError(errorData, responseData, responseError);
        break;
    }
  } else {
    result = parseZohoServerErrorResponseData(errorResponseData as ZohoServerErrorResponseData, responseError);
  }

  return result;
}

/**
 * Pre-configured console logger for Zoho Analytics server errors.
 */
export const logZohoAnalyticsErrorToConsole = logZohoServerErrorFunction('ZohoAnalytics', { logDataArrayErrors: false });

/**
 * Parses a fetch response error into a typed Zoho Analytics error by reading and interpreting the
 * JSON error body.
 *
 * @param responseError - The fetch response error to parse.
 * @returns The parsed Zoho server error, or undefined if the response could not be parsed.
 */
export async function parseZohoAnalyticsError(responseError: FetchResponseError): Promise<ParsedZohoServerError> {
  const data: unknown = await responseError.response.json().catch(() => undefined);
  let result: ParsedZohoServerError;

  if (data) {
    result = parseZohoAnalyticsServerErrorResponseData(data, responseError);
  }

  return result;
}

/**
 * Fetch response interceptor that detects a Zoho Analytics failure envelope returned with an HTTP
 * 200 status and converts it into a thrown error.
 *
 * The shared `interceptZohoErrorResponseFactory` cannot be reused here: it looks for an
 * `error` key, which Analytics never sets.
 *
 * @param json - The parsed response body.
 * @param response - The originating HTTP response.
 * @returns The body unchanged when it is not a failure envelope.
 * @throws {ZohoServerFetchResponseError} When the body is an Analytics failure envelope.
 */
export const interceptZohoAnalytics200StatusWithErrorResponse: FetchJsonInterceptJsonResponseFunction = (json: unknown, response: Response) => {
  if (isZohoAnalyticsErrorResponseData(json)) {
    const parsedError = parseZohoAnalyticsServerErrorResponseData(json, new FetchResponseError(response));

    if (parsedError) {
      throw parsedError;
    }
  }

  return json;
};

/**
 * Wraps a fetch function with Zoho Analytics error parsing and console logging, ensuring all
 * Analytics API errors are surfaced as typed exceptions.
 */
export const handleZohoAnalyticsErrorFetch = handleZohoErrorFetchFactory(parseZohoAnalyticsError, logZohoAnalyticsErrorToConsole);
