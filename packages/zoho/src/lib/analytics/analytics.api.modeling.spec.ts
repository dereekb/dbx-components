import { describe, it, expect, vi } from 'vitest';
import { type ZohoAnalyticsContext } from './analytics.config';
import { zohoAnalyticsDeleteView, zohoAnalyticsDeleteWorkspace } from './analytics.api.modeling';

/**
 * Builds a minimal mock {@link ZohoAnalyticsContext} whose `fetchJson` resolves to the given value,
 * so modeling request construction can be asserted without hitting the live Zoho API.
 *
 * @param resolved - Value the mocked `fetchJson` resolves with.
 * @returns The mock context and its `fetchJson` spy.
 */
function mockZohoAnalyticsContext<T>(resolved: T) {
  const fetchJson = vi.fn().mockResolvedValue(resolved);
  const context = { fetchJson, config: { apiUrl: 'production', orgId: '1234' } } as unknown as ZohoAnalyticsContext;
  return { context, fetchJson };
}

/**
 * Parses the CONFIG parameter out of a request URL's query string.
 *
 * @param url - The request URL the client built.
 * @returns The decoded config, or undefined when the URL carries no query string.
 */
function readUrlConfig(url: string): unknown {
  const [, query] = url.split('?');
  const raw = query ? new URLSearchParams(query).get('CONFIG') : null;
  return raw == null ? undefined : JSON.parse(raw);
}

describe('zohoAnalyticsDeleteView()', () => {
  it('should DELETE the workspace-scoped view path', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext(null);

    await zohoAnalyticsDeleteView(context)({ workspaceId: 'w1', viewId: 'v1' });

    const [url, input] = fetchJson.mock.calls[0];
    expect(input.method).toBe('DELETE');
    // no config given, so no CONFIG parameter is appended at all
    expect(url).toBe('/workspaces/w1/views/v1');
  });

  it('should send deleteDependentViews in the query string rather than a form body', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext(null);

    await zohoAnalyticsDeleteView(context)({ workspaceId: 'w1', viewId: 'v1', config: { deleteDependentViews: true } });

    const [url, input] = fetchJson.mock.calls[0];
    // the Modeling deletes take their CONFIG as a query parameter, unlike the row writes next door
    // which take a form-urlencoded body — verified against the live API
    expect(readUrlConfig(url)).toEqual({ deleteDependentViews: true });
    expect(input.body).toBeUndefined();
    expect(input.headers).toBeUndefined();
  });

  it('should not infer a dependent-view cascade from an empty config', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext(null);

    await zohoAnalyticsDeleteView(context)({ workspaceId: 'w1', viewId: 'v1', config: {} });

    const [url] = fetchJson.mock.calls[0];
    expect(readUrlConfig(url)).toEqual({});
  });

  it('should resolve null, since a successful delete is a 204 with no body', async () => {
    const { context } = mockZohoAnalyticsContext(null);

    await expect(zohoAnalyticsDeleteView(context)({ workspaceId: 'w1', viewId: 'v1' })).resolves.toBeNull();
  });
});

describe('zohoAnalyticsDeleteWorkspace()', () => {
  it('should DELETE the workspace path with no config, which the endpoint does not accept', async () => {
    const { context, fetchJson } = mockZohoAnalyticsContext(null);

    await zohoAnalyticsDeleteWorkspace(context)({ workspaceId: 'w1' });

    const [url, input] = fetchJson.mock.calls[0];
    expect(url).toBe('/workspaces/w1');
    expect(input.method).toBe('DELETE');
    expect(input.body).toBeUndefined();
  });
});
