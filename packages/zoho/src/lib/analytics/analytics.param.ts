import { type Maybe } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';

/**
 * Name of the single parameter that carries every Zoho Analytics request option.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-specification.html
 */
export const ZOHO_ANALYTICS_CONFIG_PARAM = 'CONFIG';

/**
 * Content type used when a Zoho Analytics `CONFIG` is sent in the request body.
 */
export const ZOHO_ANALYTICS_FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';

/**
 * The options object for a Zoho Analytics request.
 *
 * Zoho Analytics does not accept a normal JSON request body. Instead every option is collected
 * into a single `CONFIG` parameter whose value is the JSON of this object, URL-encoded.
 *
 * Where that parameter is placed depends on the API family:
 *
 * - the query string for every `GET`, and for every Bulk API write (import/export); use
 *   {@link zohoAnalyticsConfigQuerySuffix}
 * - an `application/x-www-form-urlencoded` body for Data API row CRUD and Modeling API writes;
 *   use {@link zohoAnalyticsFormApiFetchJsonInput}
 *
 * @see https://www.zoho.com/analytics/api/v2/api-specification.html
 */
export type ZohoAnalyticsRequestConfig = object;

/**
 * Encodes a {@link ZohoAnalyticsRequestConfig} as `CONFIG=<url-encoded json>`.
 *
 * Keys with an `undefined` value are dropped by JSON serialization, so optional request options
 * can be passed through without filtering them first.
 *
 * @param config - The request options to encode, if any.
 * @returns The encoded parameter, or an empty string when no config is provided.
 */
export function zohoAnalyticsConfigParamString(config?: Maybe<ZohoAnalyticsRequestConfig>): string {
  return config == null ? '' : makeUrlSearchParams({ [ZOHO_ANALYTICS_CONFIG_PARAM]: JSON.stringify(config) }).toString();
}

/**
 * Encodes a {@link ZohoAnalyticsRequestConfig} as a query string suffix ready to append to a URL.
 *
 * @param config - The request options to encode, if any.
 * @returns `'?CONFIG=...'`, or an empty string when no config is provided.
 */
export function zohoAnalyticsConfigQuerySuffix(config?: Maybe<ZohoAnalyticsRequestConfig>): string {
  const params = zohoAnalyticsConfigParamString(config);
  return params ? `?${params}` : '';
}

/**
 * Constructs the standard FetchJsonInput used by Zoho Analytics calls that carry their `CONFIG`
 * in the query string, pairing the HTTP method with an optional body.
 *
 * @param method - HTTP method to use for the request.
 * @param body - Optional request body to include.
 * @returns Configured fetch input for the Zoho Analytics API call.
 */
export function zohoAnalyticsApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return {
    method,
    body: body ?? undefined
  };
}

/**
 * Constructs the FetchJsonInput for a Zoho Analytics call that carries its `CONFIG` in an
 * `application/x-www-form-urlencoded` body, as the Data API row operations and the Modeling API
 * writes require.
 *
 * The content type is set explicitly to override the JSON default applied by the Analytics fetch
 * factory.
 *
 * @param method - HTTP method to use for the request.
 * @param config - Request options to encode into the body.
 * @returns Configured fetch input carrying the encoded config as its body.
 */
export function zohoAnalyticsFormApiFetchJsonInput(method: string, config: ZohoAnalyticsRequestConfig): FetchJsonInput {
  return {
    method,
    headers: { 'Content-Type': ZOHO_ANALYTICS_FORM_CONTENT_TYPE },
    body: zohoAnalyticsConfigParamString(config)
  };
}
