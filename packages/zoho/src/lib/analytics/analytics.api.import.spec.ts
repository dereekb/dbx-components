import { describe, it, expect, vi } from 'vitest';
import { type ZohoAnalyticsContext } from './analytics.config';
import { zohoAnalyticsImportDataInNewTable, zohoAnalyticsImportDataInTable, zohoAnalyticsImportFormData } from './analytics.api.import';

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
