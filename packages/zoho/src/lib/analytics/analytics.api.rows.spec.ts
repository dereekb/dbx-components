import { describe, it, expect, vi } from 'vitest';
import { type ZohoAnalyticsContext } from './analytics.config';
import { zohoAnalyticsAddRow, zohoAnalyticsDeleteRows, zohoAnalyticsUpdateRows } from './analytics.api.rows';

/**
 * Builds a minimal mock {@link ZohoAnalyticsContext} whose `fetchJson` resolves to the given value,
 * so row request construction can be asserted without hitting the live Zoho API.
 */
function mockZohoAnalyticsContext<T>(resolved: T) {
  const fetchJson = vi.fn().mockResolvedValue(resolved);
  const context = { fetchJson, config: { apiUrl: 'production', orgId: '1234' } } as unknown as ZohoAnalyticsContext;
  return { context, fetchJson };
}

/**
 * Parses the CONFIG field out of a form-urlencoded request body.
 */
function readBodyConfig(body: string): unknown {
  return JSON.parse(new URLSearchParams(body).get('CONFIG') as string);
}

const target = { workspaceId: 'w1', viewId: 'v1' };

describe('zohoAnalyticsAddRow()', () => {
  it('should POST the columns as a form-urlencoded CONFIG body', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext({ status: 'success', summary: 'Add row', data: { addedColumns: { Region: 'East' } } });

    await zohoAnalyticsAddRow(context)({ ...target, config: { columns: { Region: 'East' } } });

    const [url, input] = fetchJson.mock.calls[0];
    expect(url).toBe('/workspaces/w1/views/v1/rows');
    expect(input.method).toBe('POST');
    expect(input.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(readBodyConfig(input.body)).toEqual({ columns: { Region: 'East' } });
  });
});

describe('zohoAnalyticsUpdateRows()', () => {
  it('should PUT the criteria and columns', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext({ status: 'success', summary: 'Update rows', data: { updatedRows: 2 } });
    const criteria = `"Sales"."Region"='West'`;

    await zohoAnalyticsUpdateRows(context)({ ...target, config: { columns: { Region: 'East' }, criteria } });

    const [, input] = fetchJson.mock.calls[0];
    expect(input.method).toBe('PUT');
    expect(readBodyConfig(input.body)).toEqual({ columns: { Region: 'East' }, criteria });
  });

  it('should allow an explicit updateAllRows', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext({ status: 'success', summary: 'Update rows', data: { updatedRows: 9 } });

    await zohoAnalyticsUpdateRows(context)({ ...target, config: { columns: { Region: 'East' }, updateAllRows: true } });

    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('should refuse to update without criteria or updateAllRows, rather than rewriting the table', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext({});

    expect(() => zohoAnalyticsUpdateRows(context)({ ...target, config: { columns: { Region: 'East' } } })).toThrow();
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

describe('zohoAnalyticsDeleteRows()', () => {
  it('should DELETE with the criteria', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext({ status: 'success', summary: 'Delete rows', data: { deletedRows: 3 } });
    const criteria = `"Sales"."Region"='West'`;

    await zohoAnalyticsDeleteRows(context)({ ...target, config: { criteria } });

    const [, input] = fetchJson.mock.calls[0];
    expect(input.method).toBe('DELETE');
    expect(readBodyConfig(input.body)).toEqual({ criteria });
  });

  it('should refuse to delete without criteria or deleteAllRows, rather than emptying the table', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext({});

    expect(() => zohoAnalyticsDeleteRows(context)({ ...target, config: {} })).toThrow();
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
