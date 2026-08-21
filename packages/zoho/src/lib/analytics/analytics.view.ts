import { type SuggestedString } from '@dereekb/util';
import { type ZohoAnalyticsColumnId, type ZohoAnalyticsFolderId, type ZohoAnalyticsName, type ZohoAnalyticsOrgId, type ZohoAnalyticsTimestampString, type ZohoAnalyticsViewId, type ZohoAnalyticsWorkspaceId } from './analytics';

/**
 * Type of a view in Zoho Analytics.
 *
 * Zoho returns this in mixed case across endpoints — `GET /workspaces/{id}/views` reports
 * `'TABLE'` while `GET /views/{id}` reports `'Table'` — so compare case-insensitively.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-views.html
 */
export type ZohoAnalyticsViewType = SuggestedString<'TABLE' | 'QUERYTABLE' | 'REPORT' | 'DASHBOARD'>;

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
}

/**
 * Full details of a single view, which include the owning workspace and organization.
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
