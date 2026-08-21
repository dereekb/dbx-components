import { type SuggestedString } from '@dereekb/util';
import { type ZohoAnalyticsColumnId, type ZohoAnalyticsFolderId, type ZohoAnalyticsName, type ZohoAnalyticsOrgId, type ZohoAnalyticsTimestampString, type ZohoAnalyticsViewId, type ZohoAnalyticsWorkspaceId } from './analytics';

/**
 * Type of a view in Zoho Analytics.
 *
 * Zoho returns this in mixed case — `'Table'`, not `'TABLE'` — from both `GET /workspaces/{id}/views`
 * and `GET /views/{id}`, verified against the live API. Only `'Table'` has been confirmed against a
 * real account; the other members are the documented view kinds and their casing is inferred, so
 * compare case-insensitively rather than against these literals.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-views.html
 */
export type ZohoAnalyticsViewType = SuggestedString<'Table' | 'QueryTable' | 'Report' | 'Dashboard'>;

/**
 * A view in Zoho Analytics: a table, query table, report, or dashboard.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-views.html
 */
export interface ZohoAnalyticsView {
  readonly viewId: ZohoAnalyticsViewId;
  readonly viewName: ZohoAnalyticsName;
  readonly viewDesc?: string;
  readonly viewType?: ZohoAnalyticsViewType;
  readonly folderId?: ZohoAnalyticsFolderId;
  readonly folderName?: string;
  readonly createdBy?: string;
  readonly createdTime?: ZohoAnalyticsTimestampString;
  /**
   * View this one was derived from, for a query table or report.
   */
  readonly parentViewId?: ZohoAnalyticsViewId;
  readonly lastModifiedTime?: ZohoAnalyticsTimestampString;
  readonly lastModifiedBy?: string;
  readonly isFavorite?: boolean;
  /**
   * Present when the view is shared with the authenticated user rather than owned by them.
   */
  readonly sharedBy?: string;
}

/**
 * Full details of a single view, which include the owning workspace and organization.
 *
 * Carries a different field set than the listing rather than a superset: it adds the owning
 * workspace/org and the design-modification fields, and drops the folder and favorite fields.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/view-details.html
 */
export interface ZohoAnalyticsViewDetails {
  readonly viewId: ZohoAnalyticsViewId;
  readonly viewName: ZohoAnalyticsName;
  readonly viewDesc?: string;
  readonly viewType?: ZohoAnalyticsViewType;
  readonly workspaceId?: ZohoAnalyticsWorkspaceId;
  readonly orgId?: ZohoAnalyticsOrgId;
  readonly createdTime?: ZohoAnalyticsTimestampString;
  readonly createdBy?: string;
  readonly createdByName?: string;
  readonly createdByZuId?: string;
  /**
   * When the view's design — its columns and formulas, not its rows — last changed.
   */
  readonly lastDesignModifiedTime?: ZohoAnalyticsTimestampString;
  readonly lastDesignModifiedBy?: string;
  readonly lastDesignModifiedByName?: string;
  readonly lastDesignModifiedByZuId?: string;
}

/**
 * Column data type in a Zoho Analytics table.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data/existing-table.html
 */
export type ZohoAnalyticsColumnDataType = SuggestedString<'PLAIN' | 'MULTI_LINE' | 'EMAIL' | 'NUMBER' | 'POSITIVE_NUMBER' | 'DECIMAL_NUMBER' | 'CURRENCY' | 'PERCENT' | 'DATE' | 'BOOLEAN' | 'URL' | 'AUTO_NUMBER' | 'GEO'>;

/**
 * Metadata describing a single column of a Zoho Analytics table.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-table-metadata.html
 */
export interface ZohoAnalyticsColumn {
  readonly columnId: ZohoAnalyticsColumnId;
  readonly columnName: ZohoAnalyticsName;
  readonly dataType?: ZohoAnalyticsColumnDataType;
  readonly dataTypeId?: number;
  readonly dataTypeName?: string;
  readonly columnIndex?: number;
  readonly columnDesc?: string;
  readonly columnMaxSize?: number;
  readonly isNullable?: boolean;
  readonly defaultValue?: string;
  readonly pkTableName?: string;
  readonly pkColumnName?: string;
  readonly formulaDisplayName?: string;
  readonly isHidden?: boolean;
  readonly sortedOrder?: number;
  readonly sortedIndex?: number;
  readonly currencyFormat?: string;
  readonly thousandSeparator?: string;
  readonly decimalSeparator?: string;
  readonly decimalPlaces?: number;
}
