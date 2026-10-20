import { DOCS_NOT_FOUND_ERROR_CODE, DOCS_SECTION_NOT_FOUND_ERROR_CODE, notFoundError, type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { describe, expect, it } from 'vitest';
import { type McpAnalyticsEvent } from './mcp.analytics.handler';
import { MCP_DOCS_READ_ANALYTICS_EVENT_NAME, MCP_DOCS_READ_ANALYTICS_KEY, MCP_DOCS_SEARCH_ANALYTICS_EVENT_NAME, MCP_DOCS_SEARCH_ANALYTICS_KEY, mcpDocsAnalyticsToolConfigs, mcpDocsReadAnalyticsEventData, mcpDocsSearchAnalyticsEventData } from './mcp.analytics.docs';

const AUTH = { uid: 'u1', token: { uid: 'u1', client_id: 'claude' } } as unknown as FirebaseServerAuthData;

function searchEvent(query: string, structuredContent?: Record<string, unknown>): McpAnalyticsEvent {
  return {
    event: 'search_demo_documentation',
    toolName: 'search_demo_documentation',
    toolKind: 'static',
    modelType: 'docs',
    call: 'search',
    uid: 'u1',
    auth: AUTH,
    args: { query, limit: 8 },
    isSuccessful: true,
    result: { content: [], ...(structuredContent == null ? undefined : { structuredContent }) }
  };
}

function readEvent(args: Record<string, unknown>, error?: unknown): McpAnalyticsEvent {
  return {
    event: 'demo_api_read',
    toolName: 'demo_api_read',
    toolKind: 'static',
    modelType: 'docs',
    call: 'read',
    method: 'docs-read',
    routed: true,
    uid: 'u1',
    auth: AUTH,
    args,
    reason: 'reading',
    isSuccessful: error == null,
    error
  };
}

describe('mcpDocsSearchAnalyticsEventData()', () => {
  it('should describe a search with hits', () => {
    const results = [{ id: 'notification/types', title: 'Types', section: { id: 'cal-inv', title: 'CAL_INV' } }, ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id }))];
    const data = mcpDocsSearchAnalyticsEventData(searchEvent('  notifications  ', { total: 9, results, partial: true }));

    expect(data).toEqual({
      query: 'notifications',
      limit: 8,
      total: 9,
      resultCount: 6,
      topResultId: 'notification/types#cal-inv',
      resultIds: 'notification/types#cal-inv,a,b,c,d',
      partial: true,
      success: true,
      tool: 'search_demo_documentation',
      clientId: 'claude'
    });
  });

  it('should describe a zero-hit search', () => {
    const data = mcpDocsSearchAnalyticsEventData(searchEvent('zebra', { total: 0, results: [] }));
    expect(data).toMatchObject({ query: 'zebra', total: 0, resultCount: 0, topResultId: '', resultIds: '', partial: false });
  });

  it('should cap the query length', () => {
    const data = mcpDocsSearchAnalyticsEventData(searchEvent('x'.repeat(500), { total: 0, results: [] }));
    expect(data['query']).toHaveLength(200);
  });

  it('should leave out the query when includeQuery is false', () => {
    const data = mcpDocsSearchAnalyticsEventData(searchEvent('alice smith', { total: 0, results: [] }), { includeQuery: false });
    expect(data).not.toHaveProperty('query');
    expect(data).toMatchObject({ total: 0, limit: 8 });
  });

  it('should leave out the result fields when the search failed', () => {
    const data = mcpDocsSearchAnalyticsEventData({ ...searchEvent('setup'), isSuccessful: false });
    expect(data).not.toHaveProperty('total');
    expect(data).toMatchObject({ query: 'setup', success: false });
  });
});

describe('mcpDocsReadAnalyticsEventData()', () => {
  it('should describe a successful read', () => {
    expect(mcpDocsReadAnalyticsEventData(readEvent({ id: 'welcome', section: 'intro' }))).toEqual({ id: 'welcome', section: 'intro', success: true, reason: 'reading', clientId: 'claude' });
  });

  it('should carry the code of a missing doc', () => {
    const error = notFoundError({ code: DOCS_NOT_FOUND_ERROR_CODE, message: 'missing' });
    expect(mcpDocsReadAnalyticsEventData(readEvent({ id: 'nope' }, error))).toMatchObject({ id: 'nope', section: '', success: false, errorCode: DOCS_NOT_FOUND_ERROR_CODE });
  });

  it('should carry the code of a missing section', () => {
    const error = notFoundError({ code: DOCS_SECTION_NOT_FOUND_ERROR_CODE, message: 'missing' });
    expect(mcpDocsReadAnalyticsEventData(readEvent({ id: 'welcome', section: 'nope' }, error))).toMatchObject({ section: 'nope', success: false, errorCode: DOCS_SECTION_NOT_FOUND_ERROR_CODE });
  });
});

describe('mcpDocsAnalyticsToolConfigs()', () => {
  it('should turn off the default event and send Docs Search / Docs Read', () => {
    const configs = mcpDocsAnalyticsToolConfigs();
    const sent: string[] = [];
    const emitter = { sendEvent: (name: string) => sent.push(name) };

    expect(MCP_DOCS_SEARCH_ANALYTICS_KEY).toBe('docs.search');
    expect(MCP_DOCS_READ_ANALYTICS_KEY).toBe('docs.read');
    expect(configs[MCP_DOCS_SEARCH_ANALYTICS_KEY].sendDefaultEvent).toBe(false);
    expect(configs[MCP_DOCS_READ_ANALYTICS_KEY].sendDefaultEvent).toBe(false);

    configs[MCP_DOCS_SEARCH_ANALYTICS_KEY].onComplete?.(emitter, searchEvent('setup', { total: 0, results: [] }));
    configs[MCP_DOCS_READ_ANALYTICS_KEY].onComplete?.(emitter, readEvent({ id: 'welcome' }));
    expect(sent).toEqual([MCP_DOCS_SEARCH_ANALYTICS_EVENT_NAME, MCP_DOCS_READ_ANALYTICS_EVENT_NAME]);
  });
});
