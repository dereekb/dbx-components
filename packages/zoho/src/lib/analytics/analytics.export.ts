import { type WebsiteUrl } from '@dereekb/util';
import { type ZohoAnalyticsCriteria, type ZohoAnalyticsName, type ZohoAnalyticsTimestampString } from './analytics';
import { type ZohoAnalyticsDelimiter, type ZohoAnalyticsQuoted } from './analytics.import';
import { type ZohoAnalyticsJobStatus } from './analytics.job';

/**
 * Format of exported Zoho Analytics data.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data.html
 */
export type ZohoAnalyticsExportResponseFormat = 'csv' | 'json' | 'xml' | 'xls' | 'pdf' | 'html' | 'image';

/**
 * Record delimiter of exported CSV data. `0` DOS, `1` UNIX, `2` MAC.
 */
export type ZohoAnalyticsRecordDelimiter = 0 | 1 | 2;

/**
 * Options controlling a Zoho Analytics data export.
 *
 * Only the data-oriented options are modeled. The presentation options that apply to the `pdf`,
 * `html` and `image` formats (margins, headers, paper size, and so on) are not, since they are
 * unrelated to moving data; pass them by extending this type if they are ever needed.
 *
 * Note there is no offset or limit option: Zoho Analytics does not paginate row data. Narrow a
 * large export with `criteria` and `selectedColumns`, or use an asynchronous export job.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data.html
 */
export interface ZohoAnalyticsExportConfig {
  readonly responseFormat: ZohoAnalyticsExportResponseFormat;
  /**
   * Restricts the export to rows matching this filter expression.
   */
  readonly criteria?: ZohoAnalyticsCriteria;
  /**
   * Restricts the export to these columns.
   */
  readonly selectedColumns?: ZohoAnalyticsName[];
  readonly showHiddenCols?: boolean;
  readonly showPersonalCols?: boolean;
  /**
   * CSV only. Field delimiter.
   */
  readonly delimiter?: ZohoAnalyticsDelimiter;
  /**
   * CSV only. Record delimiter.
   */
  readonly recordDelimiter?: ZohoAnalyticsRecordDelimiter;
  /**
   * CSV only. Quote character.
   */
  readonly quoted?: ZohoAnalyticsQuoted;
  /**
   * CSV only. Whether to include a header row. Defaults to true.
   */
  readonly includeHeader?: boolean;
  /**
   * JSON only. Whether to emit rows as column-name/value pairs. Defaults to true.
   */
  readonly keyValueFormat?: boolean;
}

/**
 * Options for an asynchronous export job.
 */
export interface ZohoAnalyticsExportJobConfig extends ZohoAnalyticsExportConfig {
  /**
   * URL that Zoho posts the job's completion status to.
   */
  readonly callbackUrl?: WebsiteUrl;
}

/**
 * Options for an asynchronous export job driven by a SQL query.
 *
 * This runs an ad-hoc query and exports its result. It does not create anything: to persist a
 * query as a reusable view, create a query table through the Modeling API instead.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data-async/create-export/sql-query.html
 */
export interface ZohoAnalyticsExportJobSqlQueryConfig extends ZohoAnalyticsExportJobConfig {
  /**
   * The SQL `SELECT` statement to export the results of.
   */
  readonly sqlQuery: string;
}

/**
 * Status of an asynchronous export job.
 */
export interface ZohoAnalyticsExportJobStatus extends ZohoAnalyticsJobStatus {
  /**
   * URL the exported file can be downloaded from once the job has completed.
   */
  readonly downloadUrl?: WebsiteUrl;
  /**
   * Epoch milliseconds at which the download expires, roughly an hour after completion.
   */
  readonly expiryTime?: ZohoAnalyticsTimestampString;
}
