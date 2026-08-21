import { type ZohoAnalyticsCriteria, type ZohoAnalyticsName, type ZohoAnalyticsResponse, type ZohoAnalyticsRow, type ZohoAnalyticsViewId, type ZohoAnalyticsWorkspaceId } from './analytics';
import { type ZohoAnalyticsContext } from './analytics.config';
import { zohoAnalyticsFormApiFetchJsonInput } from './analytics.param';

// MARK: Shared
/**
 * Date-format options shared by the row write operations.
 */
export interface ZohoAnalyticsRowDateFormatOptions {
  /**
   * Format of any date value whose format cannot be auto-detected, e.g. `'dd-MMM-YYYY'`.
   */
  readonly dateFormat?: string;
  /**
   * Per-column date formats, keyed by column name.
   */
  readonly columnDateFormat?: Record<ZohoAnalyticsName, string>;
}

/**
 * Columns rejected by a row write, keyed by column name.
 */
export type ZohoAnalyticsInvalidColumns = Record<ZohoAnalyticsName, string>;

// MARK: Add Row
/**
 * Options for adding a single row.
 */
export interface ZohoAnalyticsAddRowConfig extends ZohoAnalyticsRowDateFormatOptions {
  /**
   * The row to add, keyed by column name.
   */
  readonly columns: ZohoAnalyticsRow;
}

/**
 * Input for adding a single row to a table.
 */
export interface ZohoAnalyticsAddRowInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config: ZohoAnalyticsAddRowConfig;
}

/**
 * Payload returned when a row is added.
 */
export interface ZohoAnalyticsAddRowResult {
  /**
   * The column values that were accepted.
   */
  readonly addedColumns?: ZohoAnalyticsRow;
  /**
   * The column values that were rejected. Non-empty even on a successful response.
   */
  readonly invalidColumns?: ZohoAnalyticsInvalidColumns;
}

/**
 * Response for `POST /workspaces/{workspaceId}/views/{viewId}/rows`.
 */
export type ZohoAnalyticsAddRowResponse = ZohoAnalyticsResponse<ZohoAnalyticsAddRowResult>;

/**
 * Adds a single row to a table.
 */
export type ZohoAnalyticsAddRowFunction = (input: ZohoAnalyticsAddRowInput) => Promise<ZohoAnalyticsAddRowResponse>;

/**
 * Creates a {@link ZohoAnalyticsAddRowFunction} bound to the given context.
 *
 * Intended for single rows. Use the import operations for bulk data — a row-at-a-time loop burns
 * through the request frequency limit and costs far more API units than one import.
 *
 * A successful response can still report rejected values in `invalidColumns`.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that adds a row to a table.
 *
 * @see https://www.zoho.com/analytics/api/v2/data-api/add-row.html
 */
export function zohoAnalyticsAddRow(context: ZohoAnalyticsContext): ZohoAnalyticsAddRowFunction {
  return (input: ZohoAnalyticsAddRowInput) => context.fetchJson<ZohoAnalyticsAddRowResponse>(`/workspaces/${input.workspaceId}/views/${input.viewId}/rows`, zohoAnalyticsFormApiFetchJsonInput('POST', input.config));
}

// MARK: Update Rows
/**
 * Options for updating rows.
 *
 * Either `criteria` or `updateAllRows` must be set, so that an update cannot silently rewrite an
 * entire table.
 */
export interface ZohoAnalyticsUpdateRowsConfig extends ZohoAnalyticsRowDateFormatOptions {
  /**
   * The new column values, keyed by column name.
   */
  readonly columns: ZohoAnalyticsRow;
  /**
   * Restricts the update to rows matching this filter expression.
   */
  readonly criteria?: ZohoAnalyticsCriteria;
  /**
   * Updates every row in the table.
   */
  readonly updateAllRows?: boolean;
  /**
   * Inserts a row when `criteria` matches nothing. Defaults to false.
   */
  readonly addIfNotExist?: boolean;
}

/**
 * Input for updating rows of a table.
 */
export interface ZohoAnalyticsUpdateRowsInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config: ZohoAnalyticsUpdateRowsConfig;
}

/**
 * Payload returned when rows are updated.
 */
export interface ZohoAnalyticsUpdateRowsResult {
  readonly updatedColumns?: ZohoAnalyticsRow;
  readonly updatedRows?: number;
  readonly invalidColumns?: ZohoAnalyticsInvalidColumns;
}

/**
 * Response for `PUT /workspaces/{workspaceId}/views/{viewId}/rows`.
 */
export type ZohoAnalyticsUpdateRowsResponse = ZohoAnalyticsResponse<ZohoAnalyticsUpdateRowsResult>;

/**
 * Updates the rows of a table.
 */
export type ZohoAnalyticsUpdateRowsFunction = (input: ZohoAnalyticsUpdateRowsInput) => Promise<ZohoAnalyticsUpdateRowsResponse>;

/**
 * Creates a {@link ZohoAnalyticsUpdateRowsFunction} bound to the given context.
 *
 * Requires either `criteria` or `updateAllRows`: an update with neither would target every row,
 * which is too destructive to infer.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that updates rows of a table.
 * @throws {Error} When neither `criteria` nor `updateAllRows` is set.
 *
 * @see https://www.zoho.com/analytics/api/v2/data-api/update-row.html
 */
export function zohoAnalyticsUpdateRows(context: ZohoAnalyticsContext): ZohoAnalyticsUpdateRowsFunction {
  return (input: ZohoAnalyticsUpdateRowsInput) => {
    const { criteria, updateAllRows } = input.config;

    if (!criteria && !updateAllRows) {
      throw new Error('zohoAnalyticsUpdateRows(): either criteria or updateAllRows must be provided.');
    }

    return context.fetchJson<ZohoAnalyticsUpdateRowsResponse>(`/workspaces/${input.workspaceId}/views/${input.viewId}/rows`, zohoAnalyticsFormApiFetchJsonInput('PUT', input.config));
  };
}

// MARK: Delete Rows
/**
 * Options for deleting rows.
 *
 * Either `criteria` or `deleteAllRows` must be set, so that a delete cannot silently empty an
 * entire table.
 */
export interface ZohoAnalyticsDeleteRowsConfig {
  /**
   * Restricts the delete to rows matching this filter expression.
   */
  readonly criteria?: ZohoAnalyticsCriteria;
  /**
   * Deletes every row in the table.
   */
  readonly deleteAllRows?: boolean;
}

/**
 * Input for deleting rows of a table.
 */
export interface ZohoAnalyticsDeleteRowsInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config: ZohoAnalyticsDeleteRowsConfig;
}

/**
 * Payload returned when rows are deleted.
 */
export interface ZohoAnalyticsDeleteRowsResult {
  readonly deletedRows?: number;
}

/**
 * Response for `DELETE /workspaces/{workspaceId}/views/{viewId}/rows`.
 */
export type ZohoAnalyticsDeleteRowsResponse = ZohoAnalyticsResponse<ZohoAnalyticsDeleteRowsResult>;

/**
 * Deletes rows of a table.
 */
export type ZohoAnalyticsDeleteRowsFunction = (input: ZohoAnalyticsDeleteRowsInput) => Promise<ZohoAnalyticsDeleteRowsResponse>;

/**
 * Creates a {@link ZohoAnalyticsDeleteRowsFunction} bound to the given context.
 *
 * Requires either `criteria` or `deleteAllRows`: a delete with neither would empty the table, which
 * is too destructive to infer. To replace a table's contents wholesale, prefer a `truncateadd`
 * import, which does it in one operation.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that deletes rows of a table.
 * @throws {Error} When neither `criteria` nor `deleteAllRows` is set.
 *
 * @see https://www.zoho.com/analytics/api/v2/data-api/delete-row.html
 */
export function zohoAnalyticsDeleteRows(context: ZohoAnalyticsContext): ZohoAnalyticsDeleteRowsFunction {
  return (input: ZohoAnalyticsDeleteRowsInput) => {
    const { criteria, deleteAllRows } = input.config;

    if (!criteria && !deleteAllRows) {
      throw new Error('zohoAnalyticsDeleteRows(): either criteria or deleteAllRows must be provided.');
    }

    return context.fetchJson<ZohoAnalyticsDeleteRowsResponse>(`/workspaces/${input.workspaceId}/views/${input.viewId}/rows`, zohoAnalyticsFormApiFetchJsonInput('DELETE', input.config));
  };
}
