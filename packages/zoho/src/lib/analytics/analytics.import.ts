import { type WebsiteUrl } from '@dereekb/util';
import { type ZohoAnalyticsName, type ZohoAnalyticsViewId } from './analytics';
import { type ZohoAnalyticsColumnDataType } from './analytics.view';

/**
 * How an import combines incoming data with the rows already in the target table.
 *
 * - `append` adds the incoming rows, leaving existing rows untouched.
 * - `truncateadd` deletes every existing row first, making the import a full replacement.
 * - `updateadd` updates rows matching `matchingColumns` and inserts the rest.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data/existing-table.html
 */
export type ZohoAnalyticsImportType = 'append' | 'truncateadd' | 'updateadd';

/**
 * Format of the data being imported.
 */
export type ZohoAnalyticsImportFileType = 'csv' | 'json';

/**
 * What an import does when a row cannot be imported.
 *
 * - `abort` fails the whole import.
 * - `skiprow` discards the offending row and continues.
 * - `setcolumnempty` blanks the offending value and continues.
 */
export type ZohoAnalyticsImportOnError = 'abort' | 'skiprow' | 'setcolumnempty';

/**
 * Thousand separator present in the imported data.
 *
 * `0` comma, `1` dot, `2` space, `3` single quote.
 */
export type ZohoAnalyticsThousandSeparator = 0 | 1 | 2 | 3;

/**
 * Decimal separator present in the imported data. `0` dot, `1` comma.
 */
export type ZohoAnalyticsDecimalSeparator = 0 | 1;

/**
 * Field delimiter of imported CSV data.
 *
 * `0` comma, `1` tab, `2` semicolon, `3` space.
 */
export type ZohoAnalyticsDelimiter = 0 | 1 | 2 | 3;

/**
 * Text qualifier of imported CSV data.
 *
 * `0` none, `1` single quote, `2` double quote.
 */
export type ZohoAnalyticsQuoted = 0 | 1 | 2;

/**
 * Explicit data type for a column being created by an import.
 */
export interface ZohoAnalyticsImportColumnDataType {
  readonly columnName: ZohoAnalyticsName;
  readonly dataType: ZohoAnalyticsColumnDataType;
  readonly geoRole?: string;
}

/**
 * Import options shared by every import variant.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data/existing-table.html
 */
export interface ZohoAnalyticsImportBaseConfig {
  readonly fileType?: ZohoAnalyticsImportFileType;
  /**
   * Whether Zoho should auto-identify the format of the incoming data.
   */
  readonly autoIdentify?: boolean;
  readonly onError?: ZohoAnalyticsImportOnError;
  /**
   * Restricts the import to these columns.
   */
  readonly selectedColumns?: ZohoAnalyticsName[];
  /**
   * Number of leading rows to skip.
   */
  readonly skipTop?: number;
  readonly thousandSeparator?: ZohoAnalyticsThousandSeparator;
  readonly decimalSeparator?: ZohoAnalyticsDecimalSeparator;
  /**
   * Date format used by date columns that are not auto-detected, e.g. `'dd-MMM-YYYY'`.
   */
  readonly dateFormat?: string;
  /**
   * Per-column date formats, keyed by column name.
   */
  readonly columnDateFormat?: Record<ZohoAnalyticsName, string>;
  /**
   * Rows beginning with this single character are skipped.
   */
  readonly commentChar?: string;
  readonly delimiter?: ZohoAnalyticsDelimiter;
  readonly quoted?: ZohoAnalyticsQuoted;
  readonly retainColumnNames?: boolean;
}

/**
 * Import options for importing into an existing table.
 */
export interface ZohoAnalyticsImportConfig extends ZohoAnalyticsImportBaseConfig {
  readonly importType: ZohoAnalyticsImportType;
  /**
   * Columns used to match incoming rows against existing ones.
   *
   * Required when `importType` is `'updateadd'`.
   */
  readonly matchingColumns?: ZohoAnalyticsName[];
  /**
   * Explicit data types for columns added by this import.
   */
  readonly columnDataTypes?: ZohoAnalyticsImportColumnDataType[];
}

/**
 * Import options for creating a new table from the imported data.
 *
 * There is no `importType` here: a new table has nothing to append to or replace.
 */
export interface ZohoAnalyticsImportNewTableConfig extends ZohoAnalyticsImportBaseConfig {
  /**
   * Name of the table to create.
   */
  readonly tableName: ZohoAnalyticsName;
}

/**
 * Options accepted only by the asynchronous import job and batch import endpoints.
 */
export interface ZohoAnalyticsImportJobConfigOptions {
  /**
   * URL that Zoho posts the job's completion status to.
   */
  readonly callbackUrl?: WebsiteUrl;
}

/**
 * Import options for an asynchronous import job into an existing table.
 */
export interface ZohoAnalyticsImportJobConfig extends ZohoAnalyticsImportConfig, ZohoAnalyticsImportJobConfigOptions {}

/**
 * Import options for an asynchronous import job that creates a new table.
 */
export interface ZohoAnalyticsImportJobNewTableConfig extends ZohoAnalyticsImportNewTableConfig, ZohoAnalyticsImportJobConfigOptions {}

/**
 * Summary of what an import actually did.
 *
 * Compare `successRowCount` against `totalRowCount`: an import can report success overall while
 * silently rejecting individual rows.
 */
export interface ZohoAnalyticsImportSummary {
  readonly importType?: string;
  readonly totalColumnCount?: number;
  readonly selectedColumnCount?: number;
  readonly totalRowCount?: number;
  readonly successRowCount?: number;
  readonly warnings?: number;
  readonly importOperation?: string;
}

/**
 * Payload returned by a completed import.
 *
 * A response with `status: 'success'` can still describe partially rejected data — always inspect
 * `importSummary` and `importErrors` rather than treating success as "every row landed".
 */
export interface ZohoAnalyticsImportResult {
  readonly importSummary: ZohoAnalyticsImportSummary;
  /**
   * Resolved data type of each imported column, keyed by column name.
   */
  readonly columnDetails?: Record<ZohoAnalyticsName, string>;
  /**
   * Description of the rows or columns that failed to import. Empty when nothing was rejected.
   */
  readonly importErrors?: string;
  readonly viewId?: ZohoAnalyticsViewId;
}
