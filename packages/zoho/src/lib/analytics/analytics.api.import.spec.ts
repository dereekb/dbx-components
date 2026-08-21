import { describe, it, expect, vi } from 'vitest';
import { type ZohoAnalyticsContext } from './analytics.config';
import { zohoAnalyticsCreateImportJobInNewTable, zohoAnalyticsCreateImportJobInTable, zohoAnalyticsImportDataInNewTable, zohoAnalyticsImportDataInTable, zohoAnalyticsImportFormData } from './analytics.api.import';

/**
 * Builds a minimal mock {@link ZohoAnalyticsContext} whose `fetch` resolves to a JSON response,
 * so import request construction can be asserted without hitting the live Zoho API.
 */
function mockZohoAnalyticsContext<T>(resolved: T) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(resolved), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const context = { fetch, config: { apiUrl: 'production', orgId: '1234' } } as unknown as ZohoAnalyticsContext;
  return { context, fetch };
}

/**
 * Parses the CONFIG parameter out of a request URL.
 */
function readConfig(url: string): unknown {
  const query = url.slice(url.indexOf('?') + 1);
  return JSON.parse(new URLSearchParams(query).get('CONFIG') as string);
}

const successResponse = { status: 'success', summary: 'Import data', data: { importSummary: { totalRowCount: 2, successRowCount: 2 } } };

describe('zohoAnalyticsImportFormData()', () => {
  it('should send a file under the FILE field', () => {
    const file = new File(['a,b\n1,2'], 'rows.csv', { type: 'text/csv' });
    const body = zohoAnalyticsImportFormData({ file });

    expect(body.get('FILE')).toBe(file);
    expect(body.get('DATA')).toBeNull();
  });

  it('should send raw text under the DATA field', () => {
    const body = zohoAnalyticsImportFormData({ data: 'a,b\n1,2' });

    expect(body.get('DATA')).toBe('a,b\n1,2');
    expect(body.get('FILE')).toBeNull();
  });

  it('should serialize rows to JSON under the DATA field', () => {
    const rows = [{ Region: 'East' }, { Region: 'West' }];
    const body = zohoAnalyticsImportFormData({ rows });

    expect(JSON.parse(body.get('DATA') as string)).toEqual(rows);
  });

  it('should prefer the file when more than one source is given, never sending both', () => {
    const file = new File(['a'], 'a.csv');
    const body = zohoAnalyticsImportFormData({ file, data: 'ignored' });

    expect(body.get('FILE')).toBe(file);
    expect(body.get('DATA')).toBeNull();
  });

  it('should throw when no data source is provided', () => {
    expect(() => zohoAnalyticsImportFormData({})).toThrow();
  });
});

describe('zohoAnalyticsImportDataInTable()', () => {
  it('should POST to the view data endpoint with the import config in the query string', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(successResponse);

    const result = await zohoAnalyticsImportDataInTable(context)({ workspaceId: 'w1', viewId: 'v1', rows: [{ Region: 'East' }], config: { importType: 'truncateadd' } });

    expect(result).toEqual(successResponse);
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('/workspaces/w1/views/v1/data?');
    expect(init.method).toBe('POST');
    expect(readConfig(url)).toEqual({ importType: 'truncateadd', fileType: 'json' });
  });

  it('should clear the Content-Type header so fetch derives the multipart boundary', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(successResponse);

    await zohoAnalyticsImportDataInTable(context)({ workspaceId: 'w1', viewId: 'v1', rows: [{ Region: 'East' }], config: { importType: 'append' } });

    const [, init] = fetch.mock.calls[0];
    expect(init.headers).toEqual({ 'Content-Type': '' });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('should default fileType to json only when rows are provided', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(successResponse);

    await zohoAnalyticsImportDataInTable(context)({ workspaceId: 'w1', viewId: 'v1', data: 'a,b\n1,2', config: { importType: 'append' } });

    expect(readConfig(fetch.mock.calls[0][0])).toEqual({ importType: 'append' });
  });

  it('should not override an explicitly configured fileType', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(successResponse);

    await zohoAnalyticsImportDataInTable(context)({ workspaceId: 'w1', viewId: 'v1', rows: [{ Region: 'East' }], config: { importType: 'append', fileType: 'csv' } });

    expect(readConfig(fetch.mock.calls[0][0])).toEqual({ importType: 'append', fileType: 'csv' });
  });
});

/**
 * The Bulk endpoints diverge from the synchronous ones in two ways that are not in the OpenAPI spec
 * and were found against the live API: they reject a `DATA` field with "The imported file is empty",
 * and they reject a CONFIG without `fileType` as "The parameter CONFIG is not proper".
 */
describe('zohoAnalyticsCreateImportJobInTable()', () => {
  const jobResponse = { status: 'success', summary: 'Import data', data: { jobId: 'j1' } };

  it('should send rows as a FILE part rather than a DATA field', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(jobResponse);

    await zohoAnalyticsCreateImportJobInTable(context)({ workspaceId: 'w1', viewId: 'v1', rows: [{ Region: 'East' }], config: { importType: 'append' } });

    const [url, init] = fetch.mock.calls[0];
    const body = init.body as FormData;

    expect(url).toContain('/bulk/workspaces/w1/views/v1/data?');
    expect(body.get('DATA')).toBeNull();
    expect(body.get('FILE')).toBeInstanceOf(File);
    expect(await (body.get('FILE') as File).text()).toBe(JSON.stringify([{ Region: 'East' }]));
  });

  it('should always send a fileType in the config', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(jobResponse);

    await zohoAnalyticsCreateImportJobInTable(context)({ workspaceId: 'w1', viewId: 'v1', rows: [{ Region: 'East' }], config: { importType: 'append' } });

    expect(readConfig(fetch.mock.calls[0][0])).toEqual({ importType: 'append', fileType: 'json' });
  });

  it('should infer the fileType from the file name', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(jobResponse);
    const file = new File(['a,b\n1,2'], 'rows.CSV');

    await zohoAnalyticsCreateImportJobInTable(context)({ workspaceId: 'w1', viewId: 'v1', file, config: { importType: 'append' } });

    expect(readConfig(fetch.mock.calls[0][0])).toEqual({ importType: 'append', fileType: 'csv' });
    expect((fetch.mock.calls[0][1].body as FormData).get('FILE')).toBe(file);
  });

  it('should refuse an undeterminable fileType rather than letting Zoho reject the CONFIG', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(jobResponse);

    expect(() => zohoAnalyticsCreateImportJobInTable(context)({ workspaceId: 'w1', viewId: 'v1', data: 'a,b\n1,2', config: { importType: 'append' } })).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('zohoAnalyticsCreateImportJobInNewTable()', () => {
  it('should send rows as a FILE part with a fileType', async () => {
    const { context, fetch } = mockZohoAnalyticsContext({ status: 'success', summary: 'Import data', data: { jobId: 'j1' } });

    await zohoAnalyticsCreateImportJobInNewTable(context)({ workspaceId: 'w1', rows: [{ Region: 'East' }], config: { tableName: 'Sales' } });

    const [url, init] = fetch.mock.calls[0];

    expect(url).toContain('/bulk/workspaces/w1/data?');
    expect((init.body as FormData).get('FILE')).toBeInstanceOf(File);
    expect(readConfig(url)).toEqual({ tableName: 'Sales', fileType: 'json' });
  });
});

describe('zohoAnalyticsImportFormData() asFile', () => {
  it('should wrap rows in a file part named for the file type', async () => {
    const body = zohoAnalyticsImportFormData({ rows: [{ Region: 'East' }] }, { asFile: true, fileType: 'json' });
    const file = body.get('FILE') as File;

    expect(body.get('DATA')).toBeNull();
    expect(file.name).toBe('import.json');
    expect(await file.text()).toBe(JSON.stringify([{ Region: 'East' }]));
  });

  it('should wrap raw text in a file part', async () => {
    const body = zohoAnalyticsImportFormData({ data: 'a,b\n1,2' }, { asFile: true, fileType: 'csv' });
    const file = body.get('FILE') as File;

    expect(file.name).toBe('import.csv');
    expect(await file.text()).toBe('a,b\n1,2');
  });

  it('should pass an already-provided file through untouched', () => {
    const file = new File(['a,b\n1,2'], 'rows.csv');
    const body = zohoAnalyticsImportFormData({ file }, { asFile: true, fileType: 'csv' });

    expect(body.get('FILE')).toBe(file);
  });
});

describe('zohoAnalyticsImportDataInNewTable()', () => {
  it('should POST to the workspace data endpoint with the table name and no import type', async () => {
    const { context, fetch } = mockZohoAnalyticsContext(successResponse);

    await zohoAnalyticsImportDataInNewTable(context)({ workspaceId: 'w1', rows: [{ Region: 'East' }], config: { tableName: 'Sales' } });

    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/workspaces/w1/data?');
    expect(url).not.toContain('/views/');
    expect(readConfig(url)).toEqual({ tableName: 'Sales', fileType: 'json' });
  });
});
