import { type Maybe, type Milliseconds, MS_IN_SECOND, performTaskLoop, waitForMs } from '@dereekb/util';
import { type ZohoAnalyticsJobId, type ZohoAnalyticsTimestampString } from './analytics';

/**
 * Status code of an asynchronous Zoho Analytics import or export job.
 *
 * Returned as a string even though the values are numeric.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/export-data-async/get-export.html
 */
export type ZohoAnalyticsJobCode = string;

/**
 * The job has been accepted but has not started yet. Keep polling.
 */
export const ZOHO_ANALYTICS_JOB_CODE_NOT_INITIATED: ZohoAnalyticsJobCode = '1001';

/**
 * The job is running. Keep polling.
 */
export const ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS: ZohoAnalyticsJobCode = '1002';

/**
 * The job failed.
 */
export const ZOHO_ANALYTICS_JOB_CODE_ERROR: ZohoAnalyticsJobCode = '1003';

/**
 * The job finished successfully. Export results can now be downloaded.
 */
export const ZOHO_ANALYTICS_JOB_CODE_COMPLETED: ZohoAnalyticsJobCode = '1004';

/**
 * No job exists for the given id.
 */
export const ZOHO_ANALYTICS_JOB_CODE_NOT_FOUND: ZohoAnalyticsJobCode = '1005';

/**
 * Maximum number of concurrent import jobs, and separately export jobs, allowed per organization.
 *
 * @see https://www.zoho.com/analytics/api/v2/bulk-api/import-data-async/create-import-job/existing-table.html
 */
export const ZOHO_ANALYTICS_MAX_CONCURRENT_JOBS = 5;

/**
 * Default interval between Zoho Analytics job status checks.
 *
 * Checking job status costs zero API units, so polling is inexpensive; the interval exists to stay
 * within the request frequency limit.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-units.html
 */
export const DEFAULT_ZOHO_ANALYTICS_JOB_POLL_WAIT: Milliseconds = MS_IN_SECOND * 2;

/**
 * Default maximum number of Zoho Analytics job status checks before giving up.
 */
export const DEFAULT_ZOHO_ANALYTICS_JOB_MAX_POLLS = 150;

/**
 * Common shape of an asynchronous Zoho Analytics job status.
 */
export interface ZohoAnalyticsJobStatus {
  readonly jobId: ZohoAnalyticsJobId;
  readonly jobCode: ZohoAnalyticsJobCode;
  /**
   * Epoch milliseconds at which the job's result stops being retrievable, roughly an hour after
   * completion.
   *
   * Returned by import jobs as well as export jobs, despite being documented only for exports.
   */
  readonly expiryTime?: ZohoAnalyticsTimestampString;
  /**
   * Human-readable status, e.g. `'JOB COMPLETED'`.
   */
  readonly jobStatus: string;
}

/**
 * Returns true while the job is still queued or running and should continue to be polled.
 *
 * @param jobCode - The job's current status code.
 * @returns Whether the job has not yet reached a terminal state.
 */
export function isZohoAnalyticsJobPending(jobCode: ZohoAnalyticsJobCode): boolean {
  return jobCode === ZOHO_ANALYTICS_JOB_CODE_NOT_INITIATED || jobCode === ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS;
}

/**
 * Returns true when the job finished successfully.
 *
 * @param jobCode - The job's current status code.
 * @returns Whether the job completed.
 */
export function isZohoAnalyticsJobComplete(jobCode: ZohoAnalyticsJobCode): boolean {
  return jobCode === ZOHO_ANALYTICS_JOB_CODE_COMPLETED;
}

/**
 * Returns true when the job reached a terminal failure, either erroring or not existing.
 *
 * @param jobCode - The job's current status code.
 * @returns Whether the job failed.
 */
export function isZohoAnalyticsJobError(jobCode: ZohoAnalyticsJobCode): boolean {
  return jobCode === ZOHO_ANALYTICS_JOB_CODE_ERROR || jobCode === ZOHO_ANALYTICS_JOB_CODE_NOT_FOUND;
}

/**
 * Configuration for {@link pollZohoAnalyticsJob}.
 */
export interface PollZohoAnalyticsJobConfig<T> {
  /**
   * Loads the job's current status.
   */
  readonly loadJob: () => Promise<T>;
  /**
   * Reads the status code from a loaded job.
   */
  readonly readJobCode: (job: T) => ZohoAnalyticsJobCode;
  /**
   * Milliseconds to wait between status checks.
   *
   * Defaults to {@link DEFAULT_ZOHO_ANALYTICS_JOB_POLL_WAIT}.
   */
  readonly pollWait?: Milliseconds;
  /**
   * Maximum number of status checks before returning the last observed job.
   *
   * Defaults to {@link DEFAULT_ZOHO_ANALYTICS_JOB_MAX_POLLS}.
   */
  readonly maxPolls?: number;
}

/**
 * Polls an asynchronous Zoho Analytics job until it reaches a terminal state.
 *
 * Resolves with the last observed job, whether it completed, errored, or the poll budget ran out.
 * Inspect the returned job's code with {@link isZohoAnalyticsJobComplete} and
 * {@link isZohoAnalyticsJobError} — a job still pending on return means the budget was exhausted
 * rather than that it failed.
 *
 * @param config - The job loader, status reader, and polling budget.
 * @returns The last observed job status.
 */
export function pollZohoAnalyticsJob<T>(config: PollZohoAnalyticsJobConfig<T>): Promise<T> {
  const { loadJob, readJobCode, pollWait = DEFAULT_ZOHO_ANALYTICS_JOB_POLL_WAIT, maxPolls = DEFAULT_ZOHO_ANALYTICS_JOB_MAX_POLLS } = config;

  return performTaskLoop<T>({
    next: async (i: number) => {
      if (i > 0) {
        await waitForMs(pollWait);
      }

      return loadJob();
    },
    checkContinue: (job: Maybe<T>, i: number) => job != null && isZohoAnalyticsJobPending(readJobCode(job)) && i < maxPolls
  });
}
