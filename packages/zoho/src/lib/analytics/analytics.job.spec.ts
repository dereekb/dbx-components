import { describe, it, expect, vi } from 'vitest';
import {
  ZOHO_ANALYTICS_JOB_CODE_COMPLETED,
  ZOHO_ANALYTICS_JOB_CODE_ERROR,
  ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS,
  ZOHO_ANALYTICS_JOB_CODE_NOT_FOUND,
  ZOHO_ANALYTICS_JOB_CODE_NOT_INITIATED,
  type ZohoAnalyticsJobStatus,
  isZohoAnalyticsJobComplete,
  isZohoAnalyticsJobError,
  isZohoAnalyticsJobPending,
  pollZohoAnalyticsJob
} from './analytics.job';

/**
 * Builds a job status carrying the given code.
 */
function job(jobCode: string): ZohoAnalyticsJobStatus {
  return { jobId: 'j1', jobCode, jobStatus: jobCode };
}

describe('Zoho Analytics job code predicates', () => {
  it('should treat not-initiated and in-progress as pending', () => {
    expect(isZohoAnalyticsJobPending(ZOHO_ANALYTICS_JOB_CODE_NOT_INITIATED)).toBe(true);
    expect(isZohoAnalyticsJobPending(ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS)).toBe(true);
  });

  it('should not treat a terminal code as pending', () => {
    expect(isZohoAnalyticsJobPending(ZOHO_ANALYTICS_JOB_CODE_COMPLETED)).toBe(false);
    expect(isZohoAnalyticsJobPending(ZOHO_ANALYTICS_JOB_CODE_ERROR)).toBe(false);
    expect(isZohoAnalyticsJobPending(ZOHO_ANALYTICS_JOB_CODE_NOT_FOUND)).toBe(false);
  });

  it('should identify completion and failure separately', () => {
    expect(isZohoAnalyticsJobComplete(ZOHO_ANALYTICS_JOB_CODE_COMPLETED)).toBe(true);
    expect(isZohoAnalyticsJobError(ZOHO_ANALYTICS_JOB_CODE_ERROR)).toBe(true);
    expect(isZohoAnalyticsJobError(ZOHO_ANALYTICS_JOB_CODE_NOT_FOUND)).toBe(true);
    expect(isZohoAnalyticsJobError(ZOHO_ANALYTICS_JOB_CODE_COMPLETED)).toBe(false);
  });
});

describe('pollZohoAnalyticsJob()', () => {
  it('should poll until the job completes and return the completed job', async () => {
    const loadJob = vi.fn().mockResolvedValueOnce(job(ZOHO_ANALYTICS_JOB_CODE_NOT_INITIATED)).mockResolvedValueOnce(job(ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS)).mockResolvedValueOnce(job(ZOHO_ANALYTICS_JOB_CODE_COMPLETED));

    const result = await pollZohoAnalyticsJob<ZohoAnalyticsJobStatus>({ loadJob, readJobCode: (x) => x.jobCode, pollWait: 0 });

    expect(result.jobCode).toBe(ZOHO_ANALYTICS_JOB_CODE_COMPLETED);
    expect(loadJob).toHaveBeenCalledTimes(3);
  });

  it('should stop immediately once the job reports an error', async () => {
    const loadJob = vi.fn().mockResolvedValue(job(ZOHO_ANALYTICS_JOB_CODE_ERROR));

    const result = await pollZohoAnalyticsJob<ZohoAnalyticsJobStatus>({ loadJob, readJobCode: (x) => x.jobCode, pollWait: 0 });

    expect(result.jobCode).toBe(ZOHO_ANALYTICS_JOB_CODE_ERROR);
    expect(loadJob).toHaveBeenCalledTimes(1);
  });

  it('should give up after maxPolls and return the last pending job', async () => {
    const loadJob = vi.fn().mockResolvedValue(job(ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS));

    const result = await pollZohoAnalyticsJob<ZohoAnalyticsJobStatus>({ loadJob, readJobCode: (x) => x.jobCode, pollWait: 0, maxPolls: 3 });

    expect(loadJob).toHaveBeenCalledTimes(3);
    expect(isZohoAnalyticsJobPending(result.jobCode)).toBe(true);
  });
});
