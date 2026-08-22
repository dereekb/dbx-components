/**
 * Identifier of a Zoho Analytics organization.
 *
 * Sent as the `ZANALYTICS-ORGID` header on every request except `GET /orgs`, which is
 * the bootstrap call used to discover it.
 */
export type ZohoAnalyticsOrgId = string;

/**
 * Generic identifier in Zoho Analytics.
 */
export type ZohoAnalyticsId = string;

/**
 * Identifier of a workspace in Zoho Analytics.
 */
export type ZohoAnalyticsWorkspaceId = string;

/**
 * Identifier of a view in Zoho Analytics.
 *
 * A view is any of a table, query table, dashboard, or report. View ids are globally
 * unique, which is why `GET /views/{viewId}` is not workspace-scoped.
 */
export type ZohoAnalyticsViewId = string;

/**
 * Identifier of a column within a Zoho Analytics view.
 */
export type ZohoAnalyticsColumnId = string;

/**
 * Identifier of a folder in a Zoho Analytics workspace.
 */
export type ZohoAnalyticsFolderId = string;

/**
 * Identifier of an asynchronous import or export job in Zoho Analytics.
 */
export type ZohoAnalyticsJobId = string;

/**
 * Key that chains together the requests of a batch import.
 *
 * The first request of a batch sends the literal `'start'`, and the response returns the
 * generated key that every subsequent request in the batch must echo back.
 */
export type ZohoAnalyticsBatchKey = string;

/**
 * Sentinel {@link ZohoAnalyticsBatchKey} that begins a new batch import.
 */
export const ZOHO_ANALYTICS_BATCH_KEY_START: ZohoAnalyticsBatchKey = 'start';

/**
 * Name of a table or column in Zoho Analytics.
 */
export type ZohoAnalyticsName = string;

/**
 * A row of data in a Zoho Analytics table, keyed by column name.
 */
export type ZohoAnalyticsRow = Record<ZohoAnalyticsName, unknown>;

/**
 * A raw filter expression evaluated by Zoho Analytics against a view.
 *
 * The syntax is a SQL-like boolean expression over quoted table and column names, for
 * example `"Sales"."Region"='West'`. There is no structured alternative, so callers build
 * and escape this string themselves.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data.html
 */
export type ZohoAnalyticsCriteria = string;

/**
 * Standard envelope wrapping every Zoho Analytics API response.
 *
 * Successful responses carry `status: 'success'`; failures use the same envelope with
 * `status: 'failure'` and are converted into thrown errors by the Analytics error parser.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-specification.html
 */
export interface ZohoAnalyticsResponse<T> {
  /**
   * `'success'` on a successful call.
   */
  readonly status: string;
  /**
   * Human-readable description of the operation performed, e.g. `'Get all workspaces'`.
   */
  readonly summary: string;
  readonly data: T;
}

/**
 * Epoch milliseconds returned by Zoho Analytics as a string, e.g. `'1548914379156'`.
 */
export type ZohoAnalyticsTimestampString = string;
