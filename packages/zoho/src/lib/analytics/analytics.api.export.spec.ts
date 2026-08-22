import { describe, it, expect, vi } from 'vitest';
import { type ZohoAnalyticsContext } from './analytics.config';
import { ZOHO_ANALYTICS_JOB_CODE_COMPLETED, ZOHO_ANALYTICS_JOB_CODE_ERROR, ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS } from './analytics.job';
import { zohoAnalyticsCreateExportJob, zohoAnalyticsCreateExportJobForSqlQuery, zohoAnalyticsDownloadExport, zohoAnalyticsExportData, zohoAnalyticsExportDataAndAwaitJob, zohoAnalyticsGetExportJob } from './analytics.api.export';

/**
 * Builds a minimal mock {@link ZohoAnalyticsContext} so export request construction can be asserted
 * without hitting the live Zoho API.
 *
 * Both fetch entry points are mocked: the two operations that resolve with a raw file response use
 * `fetch`, while the job operations use `fetchJson`.
 */
function mockZohoAnalyticsContext() {
  const fetch = vi.fn().mockResolvedValue(new Response('Region,Amount\nEast,100'));
  const fetchJson = vi.fn();
  const context = { fetch, fetchJson, config: { apiUrl: 'production', orgId: '1234' } } as unknown as ZohoAnalyticsContext;
  return { context, fetch, fetchJson };
}

/**
 * Parses the CONFIG parameter out of a request URL.
 */
function readConfig(url: string): unknown {
  const query = url.slice(url.indexOf('?') + 1);
  return JSON.parse(new URLSearchParams(query).get('CONFIG') as string);
}

/**
 * Builds an export job status response carrying the given code.
 */
function jobResponse(jobCode: string) {
  return { status: 'success', summary: 'Get export job', data: { jobId: 'j1', jobCode, jobStatus: jobCode } };
}

const target = { workspaceId: 'w1', viewId: 'v1' };

describe('zohoAnalyticsExportData()', () => {
  it('should GET the view data endpoint with the export config in the query string', async () => {
    const { context, fetch } = mockZohoAnalyticsContext();

    await zohoAnalyticsExportData(context)({ ...target, config: { responseFormat: 'csv' } });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('/workspaces/w1/views/v1/data?');
    expect(init.method).toBe('GET');
    expect(readConfig(url)).toEqual({ responseFormat: 'csv' });
  });

  it('should encode the array options inside the single CONFIG parameter', async () => {
    const { context, fetch } = mockZohoAnalyticsContext();

    await zohoAnalyticsExportData(context)({ ...target, config: { responseFormat: 'json', selectedColumns: ['Region', 'Amount'] } });

    expect(readConfig(fetch.mock.calls[0][0])).toEqual({ responseFormat: 'json', selectedColumns: ['Region', 'Amount'] });
  });

  it('should resolve with the raw response rather than a parsed body, since the caller picks the format', async () => {
    const { context } = mockZohoAnalyticsContext();

    const result = await zohoAnalyticsExportData(context)({ ...target, config: { responseFormat: 'csv' } });

    expect(result).toBeInstanceOf(Response);
    expect(await result.text()).toContain('Region');
  });
});

describe('zohoAnalyticsCreateExportJob()', () => {
  it('should GET the bulk view data endpoint', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext();
    fetchJson.mockResolvedValue({ status: 'success', summary: 'Export data', data: { jobId: 'j1' } });

    await zohoAnalyticsCreateExportJob(context)({ ...target, config: { responseFormat: 'csv' } });

    const [url, input] = fetchJson.mock.calls[0];
    expect(url).toContain('/bulk/workspaces/w1/views/v1/data?');
    expect(input.method).toBe('GET');
    expect(readConfig(url)).toEqual({ responseFormat: 'csv' });
  });
});

describe('zohoAnalyticsCreateExportJobForSqlQuery()', () => {
  it('should GET the workspace-scoped bulk endpoint with the query in the config, targeting no view', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext();
    fetchJson.mockResolvedValue({ status: 'success', summary: 'Export data', data: { jobId: 'j1' } });
    const sqlQuery = `SELECT "Region" FROM "Sales"`;

    await zohoAnalyticsCreateExportJobForSqlQuery(context)({ workspaceId: 'w1', config: { responseFormat: 'json', sqlQuery } });

    const [url] = fetchJson.mock.calls[0];
    expect(url).toContain('/bulk/workspaces/w1/data?');
    expect(url).not.toContain('/views/');
    expect(readConfig(url)).toEqual({ responseFormat: 'json', sqlQuery });
  });
});

describe('zohoAnalyticsGetExportJob()', () => {
  it('should GET the export job endpoint with no config parameter', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext();
    fetchJson.mockResolvedValue(jobResponse(ZOHO_ANALYTICS_JOB_CODE_COMPLETED));

    await zohoAnalyticsGetExportJob(context)({ workspaceId: 'w1', jobId: 'j1' });

    const [url, input] = fetchJson.mock.calls[0];
    expect(url).toBe('/bulk/workspaces/w1/exportjobs/j1');
    expect(input.method).toBe('GET');
  });
});

describe('zohoAnalyticsDownloadExport()', () => {
  it('should GET the export job data endpoint and resolve with the raw response', async () => {
    const { context, fetch } = mockZohoAnalyticsContext();

    const result = await zohoAnalyticsDownloadExport(context)({ workspaceId: 'w1', jobId: 'j1' });

    expect(fetch.mock.calls[0][0]).toBe('/bulk/workspaces/w1/exportjobs/j1/data');
    expect(result).toBeInstanceOf(Response);
  });
});

describe('zohoAnalyticsExportDataAndAwaitJob()', () => {
  it('should create the job and then poll the created job id until it completes', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext();

    fetchJson
      .mockResolvedValueOnce({ status: 'success', summary: 'Export data', data: { jobId: 'j1' } })
      .mockResolvedValueOnce(jobResponse(ZOHO_ANALYTICS_JOB_CODE_IN_PROGRESS))
      .mockResolvedValueOnce(jobResponse(ZOHO_ANALYTICS_JOB_CODE_COMPLETED));

    const result = await zohoAnalyticsExportDataAndAwaitJob(context)({ ...target, config: { responseFormat: 'csv' }, poll: { pollWait: 0 } });

    expect(result.data.jobCode).toBe(ZOHO_ANALYTICS_JOB_CODE_COMPLETED);
    expect(fetchJson).toHaveBeenCalledTimes(3);
    expect(fetchJson.mock.calls[1][0]).toBe('/bulk/workspaces/w1/exportjobs/j1');
  });

  it('should return the failed job rather than throwing, so the caller decides how to handle it', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext();

    fetchJson.mockResolvedValueOnce({ status: 'success', summary: 'Export data', data: { jobId: 'j1' } }).mockResolvedValue(jobResponse(ZOHO_ANALYTICS_JOB_CODE_ERROR));

    const result = await zohoAnalyticsExportDataAndAwaitJob(context)({ ...target, config: { responseFormat: 'csv' }, poll: { pollWait: 0 } });

    expect(result.data.jobCode).toBe(ZOHO_ANALYTICS_JOB_CODE_ERROR);
    // one create and one status check: polling stops at the terminal code
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('should not pass the poll options through to the create request', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext();

    fetchJson.mockResolvedValueOnce({ status: 'success', summary: 'Export data', data: { jobId: 'j1' } }).mockResolvedValue(jobResponse(ZOHO_ANALYTICS_JOB_CODE_COMPLETED));

    await zohoAnalyticsExportDataAndAwaitJob(context)({ ...target, config: { responseFormat: 'csv' }, poll: { pollWait: 0, maxPolls: 2 } });

    expect(readConfig(fetchJson.mock.calls[0][0])).toEqual({ responseFormat: 'csv' });
  });
});
