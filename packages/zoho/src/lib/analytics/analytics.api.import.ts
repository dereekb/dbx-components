import { type Maybe } from '@dereekb/util';
import { type ZohoAnalyticsJobId, type ZohoAnalyticsResponse, type ZohoAnalyticsRow, type ZohoAnalyticsViewId, type ZohoAnalyticsWorkspaceId } from './analytics';
import { type ZohoAnalyticsContext } from './analytics.config';
import { type ZohoAnalyticsImportConfig, type ZohoAnalyticsImportFileType, type ZohoAnalyticsImportJobConfig, type ZohoAnalyticsImportJobNewTableConfig, type ZohoAnalyticsImportNewTableConfig, type ZohoAnalyticsImportResult } from './analytics.import';
import { type ZohoAnalyticsJobStatus, type PollZohoAnalyticsJobConfig, pollZohoAnalyticsJob } from './analytics.job';
import { zohoAnalyticsConfigQuerySuffix } from './analytics.param';

// MARK: Utility
/**
 * The data to import, given either as a file, as raw text, or as rows to serialize as JSON.
 *
 * Exactly one of these must be provided: Zoho Analytics accepts a `FILE` or a `DATA` field, never
 * both.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data/existing-table.html
 */
export interface ZohoAnalyticsImportDataInput {
  /**
   * The file to import. Capped at 100MB by Zoho Analytics.
   */
  readonly file?: Maybe<File>;
  /**
   * Raw CSV or JSON text to import.
   */
  readonly data?: Maybe<string>;
  /**
   * Rows to import, serialized to JSON automatically.
   *
   * A convenience over `data` for the common case of pushing records out of application code. When
   * used, the import config's `fileType` defaults to `'json'`.
   */
  readonly rows?: Maybe<ZohoAnalyticsRow[]>;
}

/**
 * Options controlling how {@link zohoAnalyticsImportFormData} encodes the data.
 */
export interface ZohoAnalyticsImportFormDataOptions {
  /**
   * Sends `data`/`rows` as a `FILE` part rather than a `DATA` field.
   *
   * Required by the Bulk (async job) endpoints, which reject a `DATA` field with
   * "The imported file is empty" — verified against the live API. The synchronous endpoints accept
   * `DATA`, so this defaults to false.
   */
  readonly asFile?: Maybe<boolean>;
  /**
   * File type, used only to name the generated file part.
   */
  readonly fileType?: Maybe<ZohoAnalyticsImportFileType>;
}

/**
 * Name given to the file part generated from `data`/`rows`.
 *
 * Zoho keys the parse off `CONFIG.fileType` rather than the file name, but a name is required by the
 * multipart encoding and an accurate extension keeps the request self-describing.
 */
const ZOHO_ANALYTICS_GENERATED_IMPORT_FILE_NAME = 'import';

/**
 * Builds the multipart body carrying the data of an import.
 *
 * @param input - The file, raw text, or rows to import.
 * @param options - How to encode the data; see {@link ZohoAnalyticsImportFormDataOptions}.
 * @returns The multipart form body to send.
 * @throws {Error} When none of `file`, `data`, or `rows` is provided.
 */
export function zohoAnalyticsImportFormData(input: ZohoAnalyticsImportDataInput, options?: Maybe<ZohoAnalyticsImportFormDataOptions>): FormData {
  const { file, data, rows } = input;
  const body = new FormData();

  if (file != null) {
    body.append('FILE', file);
  } else if (data == null && rows == null) {
    throw new Error('zohoAnalyticsImportFormData(): one of file, data, or rows must be provided.');
  } else {
    const content = data ?? JSON.stringify(rows);

    if (options?.asFile) {
      const fileType = options.fileType ?? (rows == null ? 'csv' : 'json');
      body.append('FILE', new File([content], `${ZOHO_ANALYTICS_GENERATED_IMPORT_FILE_NAME}.${fileType}`, { type: fileType === 'json' ? 'application/json' : 'text/csv' }));
    } else {
      body.append('DATA', content);
    }
  }

  return body;
}

/**
 * Resolves the effective `fileType` for an import.
 *
 * Defaults to `'json'` when rows were provided, and otherwise infers from the file's extension, so a
 * caller passing a `.csv` file does not have to restate the type.
 *
 * @param dataInput - The data being imported.
 * @param fileType - The explicitly configured file type, if any.
 * @returns The file type to send to Zoho Analytics, or undefined when it cannot be determined.
 */
function zohoAnalyticsImportFileType(dataInput: ZohoAnalyticsImportDataInput, fileType: Maybe<ZohoAnalyticsImportFileType>): Maybe<ZohoAnalyticsImportFileType> {
  const { file, rows } = dataInput;
  let result: Maybe<ZohoAnalyticsImportFileType> = fileType;

  if (result == null) {
    if (rows != null) {
      result = 'json';
    } else if (file != null) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      result = extension === 'json' || extension === 'csv' ? extension : undefined;
    }
  }

  return result;
}

/**
 * Resolves the `autoIdentify` an import sends.
 *
 * Both the synchronous and the Bulk import endpoints reject a CONFIG that omits it with error 8504,
 * "The parameter CONFIG is not proper(Has not been sent or is less than required count)" — a message
 * that names neither the missing parameter nor the fix. Since an import without it cannot succeed,
 * it is defaulted here rather than left to the caller; pass `false` explicitly to opt out.
 *
 * Verified against the live API: an import of rows carrying only `importType`, and an import of a
 * CSV file carrying only `importType` and `fileType`, both fail with 8504 until this is sent.
 *
 * @param autoIdentify - The explicitly configured value, if any.
 * @returns The value to send to Zoho Analytics.
 */
function zohoAnalyticsImportAutoIdentify(autoIdentify: Maybe<boolean>): boolean {
  return autoIdentify ?? true;
}

/**
 * Resolves the `fileType` for a Bulk (async job) import, which cannot proceed without one.
 *
 * The Bulk endpoints reject a CONFIG with no `fileType` as "The parameter CONFIG is not proper",
 * which names neither the parameter at fault nor the fix — verified against the live API.
 *
 * @param dataInput - The data being imported.
 * @param fileType - The explicitly configured file type, if any.
 * @returns The resolved file type.
 * @throws {Error} When the file type is neither configured nor inferable.
 */
function zohoAnalyticsImportJobFileType(dataInput: ZohoAnalyticsImportDataInput, fileType: Maybe<ZohoAnalyticsImportFileType>): ZohoAnalyticsImportFileType {
  const result = zohoAnalyticsImportFileType(dataInput, fileType);

  if (result == null) {
    throw new Error('zohoAnalyticsCreateImportJob(): config.fileType is required for an async import job when the data is not rows or a file with a .csv/.json name.');
  }

  return result;
}

/**
 * Everything needed to perform one import request.
 */
interface ZohoAnalyticsImportRequestConfig {
  readonly context: ZohoAnalyticsContext;
  /**
   * The import URL, excluding the config query string.
   */
  readonly url: string;
  /**
   * The import config to encode into the query string.
   */
  readonly config: object;
  /**
   * The data to import.
   */
  readonly dataInput: ZohoAnalyticsImportDataInput;
  /**
   * How to encode the data; the Bulk endpoints require it as a file part.
   */
  readonly formDataOptions?: Maybe<ZohoAnalyticsImportFormDataOptions>;
}

/**
 * Performs an import request, sending the config in the query string and the data as a multipart
 * body.
 *
 * The `Content-Type` header is cleared so that fetch derives `multipart/form-data` with the correct
 * boundary from the body, overriding the JSON default applied by the Analytics fetch factory.
 *
 * @param requestConfig - The context, URL, import config, and data for the request.
 * @returns The parsed response body.
 */
async function zohoAnalyticsImportRequest<R>(requestConfig: ZohoAnalyticsImportRequestConfig): Promise<R> {
  const { context, url, config, dataInput, formDataOptions } = requestConfig;
  const body = zohoAnalyticsImportFormData(dataInput, formDataOptions);
  const response = await context.fetch(`${url}${zohoAnalyticsConfigQuerySuffix(config)}`, { method: 'POST', headers: { 'Content-Type': '' }, body });
  return response.json() as Promise<R>;
}

// MARK: Import Into Existing Table
/**
 * Input for importing data into an existing table.
 */
export interface ZohoAnalyticsImportDataInTableInput extends ZohoAnalyticsImportDataInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config: ZohoAnalyticsImportConfig;
}

/**
 * Response for a synchronous import.
 */
export type ZohoAnalyticsImportDataResponse = ZohoAnalyticsResponse<ZohoAnalyticsImportResult>;

/**
 * Imports data into an existing table and waits for the result.
 */
export type ZohoAnalyticsImportDataInTableFunction = (input: ZohoAnalyticsImportDataInTableInput) => Promise<ZohoAnalyticsImportDataResponse>;

/**
 * Creates a {@link ZohoAnalyticsImportDataInTableFunction} bound to the given context.
 *
 * Imports synchronously, returning once Zoho has processed the data. Use
 * {@link zohoAnalyticsCreateImportJobInTable} instead for large payloads, since a synchronous
 * import must finish inside the request timeout.
 *
 * What a bad row does depends on `config.onError`. Under `skiprow` or `setcolumnempty` the import
 * resolves and describes the loss in `data.importSummary` and `data.importErrors`, so a resolved
 * import does not mean every row landed. Under `abort` it throws error 7232 instead and nothing is
 * written, not even the valid rows of the same request. Verified against the live API.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that imports data into an existing table.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data/existing-table.html
 *
 * @example
 * ```ts
 * const importData = zohoAnalyticsImportDataInTable(context);
 * const { data } = await importData({
 *   workspaceId,
 *   viewId,
 *   rows: [{ Region: 'East', Sales: 100 }],
 *   config: { importType: 'truncateadd' }
 * });
 * ```
 */
export function zohoAnalyticsImportDataInTable(context: ZohoAnalyticsContext): ZohoAnalyticsImportDataInTableFunction {
  return (input: ZohoAnalyticsImportDataInTableInput) => {
    const { workspaceId, viewId, config, ...dataInput } = input;
    const requestConfig = { ...config, autoIdentify: zohoAnalyticsImportAutoIdentify(config.autoIdentify), fileType: zohoAnalyticsImportFileType(dataInput, config.fileType) };
    return zohoAnalyticsImportRequest<ZohoAnalyticsImportDataResponse>({ context, url: `/workspaces/${workspaceId}/views/${viewId}/data`, config: requestConfig, dataInput });
  };
}

// MARK: Import Into New Table
/**
 * Input for importing data into a newly created table.
 */
export interface ZohoAnalyticsImportDataInNewTableInput extends ZohoAnalyticsImportDataInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly config: ZohoAnalyticsImportNewTableConfig;
}

/**
 * Creates a table from the imported data and waits for the result.
 */
export type ZohoAnalyticsImportDataInNewTableFunction = (input: ZohoAnalyticsImportDataInNewTableInput) => Promise<ZohoAnalyticsImportDataResponse>;

/**
 * Creates a {@link ZohoAnalyticsImportDataInNewTableFunction} bound to the given context.
 *
 * The new table's id comes back on the result as `viewId`, so it does not have to be found by
 * listing the workspace afterwards. Drop the table again with `zohoAnalyticsDeleteView()`, which is
 * the only way to remove one through the API.
 *
 * A name already taken in the workspace is rejected rather than reused, so a caller that reruns this
 * has to delete the previous table first.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that creates a table in a workspace and imports data into it.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data/new-table.html
 */
export function zohoAnalyticsImportDataInNewTable(context: ZohoAnalyticsContext): ZohoAnalyticsImportDataInNewTableFunction {
  return (input: ZohoAnalyticsImportDataInNewTableInput) => {
    const { workspaceId, config, ...dataInput } = input;
    const requestConfig = { ...config, autoIdentify: zohoAnalyticsImportAutoIdentify(config.autoIdentify), fileType: zohoAnalyticsImportFileType(dataInput, config.fileType) };
    return zohoAnalyticsImportRequest<ZohoAnalyticsImportDataResponse>({ context, url: `/workspaces/${workspaceId}/data`, config: requestConfig, dataInput });
  };
}

// MARK: Async Import Jobs
/**
 * Payload returned when an asynchronous job is created.
 */
export interface ZohoAnalyticsJobCreationResult {
  readonly jobId: ZohoAnalyticsJobId;
}

/**
 * Response returned when an asynchronous import job is created.
 */
export type ZohoAnalyticsCreateImportJobResponse = ZohoAnalyticsResponse<ZohoAnalyticsJobCreationResult>;

/**
 * Input for queueing an asynchronous import into an existing table.
 */
export interface ZohoAnalyticsCreateImportJobInTableInput extends ZohoAnalyticsImportDataInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config: ZohoAnalyticsImportJobConfig;
}

/**
 * Queues an asynchronous import into an existing table.
 */
export type ZohoAnalyticsCreateImportJobInTableFunction = (input: ZohoAnalyticsCreateImportJobInTableInput) => Promise<ZohoAnalyticsCreateImportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsCreateImportJobInTableFunction} bound to the given context.
 *
 * Returns as soon as the job is queued. Poll it with {@link zohoAnalyticsGetImportJob}, or use
 * {@link zohoAnalyticsImportDataInTableAndAwaitJob} to queue and wait in one call.
 *
 * Zoho Analytics allows at most 5 concurrent import jobs per organization and caps each payload at
 * 100MB.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that queues an asynchronous import.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data-async/create-import-job/existing-table.html
 */
export function zohoAnalyticsCreateImportJobInTable(context: ZohoAnalyticsContext): ZohoAnalyticsCreateImportJobInTableFunction {
  return (input: ZohoAnalyticsCreateImportJobInTableInput) => {
    const { workspaceId, viewId, config, ...dataInput } = input;
    const fileType = zohoAnalyticsImportJobFileType(dataInput, config.fileType);
    const requestConfig = { ...config, autoIdentify: zohoAnalyticsImportAutoIdentify(config.autoIdentify), fileType };
    return zohoAnalyticsImportRequest<ZohoAnalyticsCreateImportJobResponse>({ context, url: `/bulk/workspaces/${workspaceId}/views/${viewId}/data`, config: requestConfig, dataInput, formDataOptions: { asFile: true, fileType } });
  };
}

/**
 * Input for queueing an asynchronous import that creates a new table.
 */
export interface ZohoAnalyticsCreateImportJobInNewTableInput extends ZohoAnalyticsImportDataInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly config: ZohoAnalyticsImportJobNewTableConfig;
}

/**
 * Queues an asynchronous import that creates a new table.
 */
export type ZohoAnalyticsCreateImportJobInNewTableFunction = (input: ZohoAnalyticsCreateImportJobInNewTableInput) => Promise<ZohoAnalyticsCreateImportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsCreateImportJobInNewTableFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that queues an asynchronous import into a new table.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data-async/create-import-job/new-table.html
 */
export function zohoAnalyticsCreateImportJobInNewTable(context: ZohoAnalyticsContext): ZohoAnalyticsCreateImportJobInNewTableFunction {
  return (input: ZohoAnalyticsCreateImportJobInNewTableInput) => {
    const { workspaceId, config, ...dataInput } = input;
    const fileType = zohoAnalyticsImportJobFileType(dataInput, config.fileType);
    const requestConfig = { ...config, autoIdentify: zohoAnalyticsImportAutoIdentify(config.autoIdentify), fileType };
    return zohoAnalyticsImportRequest<ZohoAnalyticsCreateImportJobResponse>({ context, url: `/bulk/workspaces/${workspaceId}/data`, config: requestConfig, dataInput, formDataOptions: { asFile: true, fileType } });
  };
}

// MARK: Import Job Status
/**
 * Status of an asynchronous import job.
 */
export interface ZohoAnalyticsImportJobStatus extends ZohoAnalyticsJobStatus {
  /**
   * Present once the job has completed.
   */
  readonly jobInfo?: ZohoAnalyticsImportResult;
}

/**
 * Response for `GET /bulk/workspaces/{workspaceId}/importjobs/{jobId}`.
 */
export type ZohoAnalyticsGetImportJobResponse = ZohoAnalyticsResponse<ZohoAnalyticsImportJobStatus>;

/**
 * Input for retrieving an import job's status.
 */
export interface ZohoAnalyticsGetImportJobInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly jobId: ZohoAnalyticsJobId;
}

/**
 * Retrieves the status of an asynchronous import job.
 */
export type ZohoAnalyticsGetImportJobFunction = (input: ZohoAnalyticsGetImportJobInput) => Promise<ZohoAnalyticsGetImportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetImportJobFunction} bound to the given context.
 *
 * Checking job status costs zero API units, so it can be polled freely within the request
 * frequency limit.
 *
 * A job id that does not exist is a thrown 404 (error 8137), not a resolved status carrying
 * `ZOHO_ANALYTICS_JOB_CODE_NOT_FOUND` — so a mistyped id rejects rather than reporting itself.
 * Verified against the live API.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that retrieves an import job's status.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data-async/get-import-job.html
 */
export function zohoAnalyticsGetImportJob(context: ZohoAnalyticsContext): ZohoAnalyticsGetImportJobFunction {
  return (input: ZohoAnalyticsGetImportJobInput) => context.fetchJson<ZohoAnalyticsGetImportJobResponse>(`/bulk/workspaces/${input.workspaceId}/importjobs/${input.jobId}`, { method: 'GET' });
}

// MARK: Import And Await
/**
 * Input for queueing an asynchronous import and waiting for it to finish.
 */
export interface ZohoAnalyticsImportDataInTableAndAwaitJobInput extends ZohoAnalyticsCreateImportJobInTableInput {
  /**
   * Overrides for how the job is polled.
   */
  readonly poll?: Omit<PollZohoAnalyticsJobConfig<ZohoAnalyticsGetImportJobResponse>, 'loadJob' | 'readJobCode'>;
}

/**
 * Queues an asynchronous import into an existing table and resolves once it reaches a terminal
 * state.
 */
export type ZohoAnalyticsImportDataInTableAndAwaitJobFunction = (input: ZohoAnalyticsImportDataInTableAndAwaitJobInput) => Promise<ZohoAnalyticsGetImportJobResponse>;

/**
 * Creates a {@link ZohoAnalyticsImportDataInTableAndAwaitJobFunction} bound to the given context.
 *
 * Queues the import, then polls until the job completes, fails, or the poll budget is exhausted.
 * The returned job is the last one observed — check it with `isZohoAnalyticsJobComplete()` and
 * `isZohoAnalyticsJobError()` rather than assuming success.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that imports asynchronously and waits for the job.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data-async/create-import-job/existing-table.html
 */
export function zohoAnalyticsImportDataInTableAndAwaitJob(context: ZohoAnalyticsContext): ZohoAnalyticsImportDataInTableAndAwaitJobFunction {
  const createImportJob = zohoAnalyticsCreateImportJobInTable(context);
  const getImportJob = zohoAnalyticsGetImportJob(context);

  return async (input: ZohoAnalyticsImportDataInTableAndAwaitJobInput) => {
    const { poll, ...createInput } = input;
    const { data } = await createImportJob(createInput);

    return pollZohoAnalyticsJob<ZohoAnalyticsGetImportJobResponse>({
      ...poll,
      loadJob: () => getImportJob({ workspaceId: input.workspaceId, jobId: data.jobId }),
      readJobCode: (job) => job.data.jobCode
    });
  };
}
