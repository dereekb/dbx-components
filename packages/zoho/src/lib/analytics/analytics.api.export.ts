import { type ZohoAnalyticsJobId, type ZohoAnalyticsResponse, type ZohoAnalyticsViewId, type ZohoAnalyticsWorkspaceId } from './analytics';
import { type ZohoAnalyticsContext } from './analytics.config';
import { type ZohoAnalyticsExportConfig, type ZohoAnalyticsExportJobConfig, type ZohoAnalyticsExportJobSqlQueryConfig, type ZohoAnalyticsExportJobStatus } from './analytics.export';
import { type ZohoAnalyticsJobCreationResult } from './analytics.api.import';
import { type PollZohoAnalyticsJobConfig, pollZohoAnalyticsJob } from './analytics.job';
import { zohoAnalyticsApiFetchJsonInput, zohoAnalyticsConfigQuerySuffix } from './analytics.param';

// MARK: Synchronous Export
/**
 * Input for exporting the data of a view.
 */
export interface ZohoAnalyticsExportDataInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config: ZohoAnalyticsExportConfig;
}

/**
 * Exports a view's data, resolving with the raw response.
 */
export type ZohoAnalyticsExportDataFunction = (input: ZohoAnalyticsExportDataInput) => Promise<Response>;

/**
 * Creates a {@link ZohoAnalyticsExportDataFunction} bound to the given context.
 *
 * Resolves with the raw {@link Response} rather than a parsed body, because the payload's type is
 * chosen by the caller through `config.responseFormat` — read it with `.json()` for the `json`
 * format and `.text()` for `csv`, `xml` and `html`.
 *
 * Zoho rejects a synchronous export for tables over 1,000,000 rows, for live-connect workspaces,
 * and for dashboard and query-table views. Use {@link zohoAnalyticsCreateExportJob} for those.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that exports a view's data.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data.html
 *
 * @example
 * ```ts
 * const exportData = zohoAnalyticsExportData(context);
 * const response = await exportData({ workspaceId, viewId, config: { responseFormat: 'csv' } });
 * const csv = await response.text();
 * ```
 */
export function zohoAnalyticsExportData(context: ZohoAnalyticsContext): ZohoAnalyticsExportDataFunction {
  return (input: ZohoAnalyticsExportDataInput) => context.fetch(`/workspaces/${input.workspaceId}/views/${input.viewId}/data${zohoAnalyticsConfigQuerySuffix(input.config)}`, { method: 'GET' });
}

// MARK: Async Export Jobs
/**
 * Response returned when an asynchronous export job is created.
 */
export type ZohoAnalyticsCreateExportJobResponse = ZohoAnalyticsResponse<ZohoAnalyticsJobCreationResult>;

/**
 * Input for queueing an asynchronous export of a view.
 */
export interface ZohoAnalyticsCreateExportJobInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config: ZohoAnalyticsExportJobConfig;
}

/**
 * Queues an asynchronous export of a view.
 */
export type ZohoAnalyticsCreateExportJobFunction = (input: ZohoAnalyticsCreateExportJobInput) => Promise<ZohoAnalyticsCreateExportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsCreateExportJobFunction} bound to the given context.
 *
 * Zoho Analytics allows at most 5 concurrent export jobs per organization, and the resulting file
 * remains downloadable for roughly one hour.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that queues an asynchronous view export.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data-async/create-export/view-id.html
 */
export function zohoAnalyticsCreateExportJob(context: ZohoAnalyticsContext): ZohoAnalyticsCreateExportJobFunction {
  return (input: ZohoAnalyticsCreateExportJobInput) => context.fetchJson<ZohoAnalyticsCreateExportJobResponse>(`/bulk/workspaces/${input.workspaceId}/views/${input.viewId}/data${zohoAnalyticsConfigQuerySuffix(input.config)}`, zohoAnalyticsApiFetchJsonInput('GET'));
}

/**
 * Input for queueing an asynchronous export driven by a SQL query.
 */
export interface ZohoAnalyticsCreateExportJobForSqlQueryInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly config: ZohoAnalyticsExportJobSqlQueryConfig;
}

/**
 * Queues an asynchronous export of a SQL query's results.
 */
export type ZohoAnalyticsCreateExportJobForSqlQueryFunction = (input: ZohoAnalyticsCreateExportJobForSqlQueryInput) => Promise<ZohoAnalyticsCreateExportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsCreateExportJobForSqlQueryFunction} bound to the given context.
 *
 * This is the only way to run ad-hoc SQL against a workspace: Zoho Analytics has no synchronous
 * query endpoint. The query result is exported as a file and nothing is persisted — to keep a query
 * as a reusable view, create a query table through the Modeling API instead.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that queues an asynchronous SQL query export.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data-async/create-export/sql-query.html
 */
export function zohoAnalyticsCreateExportJobForSqlQuery(context: ZohoAnalyticsContext): ZohoAnalyticsCreateExportJobForSqlQueryFunction {
  return (input: ZohoAnalyticsCreateExportJobForSqlQueryInput) => context.fetchJson<ZohoAnalyticsCreateExportJobResponse>(`/bulk/workspaces/${input.workspaceId}/data${zohoAnalyticsConfigQuerySuffix(input.config)}`, zohoAnalyticsApiFetchJsonInput('GET'));
}

// MARK: Export Job Status
/**
 * Response for `GET /bulk/workspaces/{workspaceId}/exportjobs/{jobId}`.
 */
export type ZohoAnalyticsGetExportJobResponse = ZohoAnalyticsResponse<ZohoAnalyticsExportJobStatus>;

/**
 * Input for retrieving an export job's status.
 */
export interface ZohoAnalyticsGetExportJobInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly jobId: ZohoAnalyticsJobId;
}

/**
 * Retrieves the status of an asynchronous export job.
 */
export type ZohoAnalyticsGetExportJobFunction = (input: ZohoAnalyticsGetExportJobInput) => Promise<ZohoAnalyticsGetExportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetExportJobFunction} bound to the given context.
 *
 * Checking job status costs zero API units.
 *
 * A job id that does not exist is a thrown 404 (error 8120), not a resolved status carrying
 * `ZOHO_ANALYTICS_JOB_CODE_NOT_FOUND`. Verified against the live API.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that retrieves an export job's status.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data-async/get-export.html
 */
export function zohoAnalyticsGetExportJob(context: ZohoAnalyticsContext): ZohoAnalyticsGetExportJobFunction {
  return (input: ZohoAnalyticsGetExportJobInput) => context.fetchJson<ZohoAnalyticsGetExportJobResponse>(`/bulk/workspaces/${input.workspaceId}/exportjobs/${input.jobId}`, zohoAnalyticsApiFetchJsonInput('GET'));
}

// MARK: Download
/**
 * Input for downloading a completed export.
 */
export type ZohoAnalyticsDownloadExportInput = ZohoAnalyticsGetExportJobInput;

/**
 * Downloads the file produced by a completed export job.
 */
export type ZohoAnalyticsDownloadExportFunction = (input: ZohoAnalyticsDownloadExportInput) => Promise<Response>;

/**
 * Creates a {@link ZohoAnalyticsDownloadExportFunction} bound to the given context.
 *
 * Resolves with the raw {@link Response} carrying the exported file. Downloading costs zero API
 * units, but the file is only available for roughly an hour after the job completes.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that downloads a completed export.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data-async/download-export.html
 */
export function zohoAnalyticsDownloadExport(context: ZohoAnalyticsContext): ZohoAnalyticsDownloadExportFunction {
  return (input: ZohoAnalyticsDownloadExportInput) => context.fetch(`/bulk/workspaces/${input.workspaceId}/exportjobs/${input.jobId}/data`, { method: 'GET' });
}

// MARK: Export And Await
/**
 * Input for queueing an asynchronous export and waiting for it to finish.
 */
export interface ZohoAnalyticsExportDataAndAwaitJobInput extends ZohoAnalyticsCreateExportJobInput {
  /**
   * Overrides for how the job is polled.
   */
  readonly poll?: Omit<PollZohoAnalyticsJobConfig<ZohoAnalyticsGetExportJobResponse>, 'loadJob' | 'readJobCode'>;
}

/**
 * Queues an asynchronous export of a view and resolves once it reaches a terminal state.
 */
export type ZohoAnalyticsExportDataAndAwaitJobFunction = (input: ZohoAnalyticsExportDataAndAwaitJobInput) => Promise<ZohoAnalyticsGetExportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsExportDataAndAwaitJobFunction} bound to the given context.
 *
 * Queues the export, then polls until the job completes, fails, or the poll budget is exhausted.
 * The returned job is the last one observed — check it with `isZohoAnalyticsJobComplete()` before
 * reading `downloadUrl`.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that exports asynchronously and waits for the job.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data-async/get-export.html
 */
export function zohoAnalyticsExportDataAndAwaitJob(context: ZohoAnalyticsContext): ZohoAnalyticsExportDataAndAwaitJobFunction {
  const createExportJob = zohoAnalyticsCreateExportJob(context);
  const getExportJob = zohoAnalyticsGetExportJob(context);

  return async (input: ZohoAnalyticsExportDataAndAwaitJobInput) => {
    const { poll, ...createInput } = input;
    const { data } = await createExportJob(createInput);

    return pollZohoAnalyticsJob<ZohoAnalyticsGetExportJobResponse>({
      ...poll,
      loadJob: () => getExportJob({ workspaceId: input.workspaceId, jobId: data.jobId }),
      readJobCode: (job) => job.data.jobCode
    });
  };
}
