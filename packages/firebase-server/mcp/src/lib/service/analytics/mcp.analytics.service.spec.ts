import { Logger } from '@nestjs/common';
import { type AnalyticsEventData } from '@dereekb/analytics';
import { type FirebaseServerAnalyticsService, type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MCP_ANALYTICS_EVENT_NAME, type FirebaseServerMcpAnalyticsConfig } from './mcp.analytics.config';
import { type McpAnalyticsEvent } from './mcp.analytics.handler';
import { FirebaseServerMcpAnalyticsService } from './mcp.analytics.service';
import { findMcpToolAnalyticsConfig, mcpToolAnalyticsKeys } from './mcp.analytics.tool';

interface SentEvent {
  readonly uid: Maybe<string>;
  readonly name: string;
  readonly data: AnalyticsEventData;
}

function makeService(config?: FirebaseServerMcpAnalyticsConfig): { service: FirebaseServerMcpAnalyticsService; sent: SentEvent[] } {
  const sent: SentEvent[] = [];
  const envService = { isProduction: false } as FirebaseServerEnvService;
  const analyticsService = { sendEventData: (uid: Maybe<string>, name: string, data: AnalyticsEventData) => sent.push({ uid, name, data }) } as unknown as FirebaseServerAnalyticsService;
  const service = new FirebaseServerMcpAnalyticsService(envService, analyticsService, { logEvents: false, ...config });
  return { service, sent };
}

const DOCS_READ_EVENT: McpAnalyticsEvent = {
  event: 'demo_api_read',
  toolName: 'demo_api_read',
  toolKind: 'static',
  modelType: 'docs',
  call: 'read',
  method: 'docs-read',
  routed: true,
  uid: 'u1',
  args: { id: 'welcome' },
  isSuccessful: true,
  durationMs: 4
};

const STATUS_EVENT: McpAnalyticsEvent = {
  event: 'demo_api_status',
  toolName: 'demo_api_status',
  toolKind: 'static',
  modelType: 'app',
  call: 'demo_api_status',
  uid: 'u1',
  isSuccessful: true
};

describe('FirebaseServerMcpAnalyticsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send the default event when the tool has no config', () => {
    const { service, sent } = makeService({ tools: { other: { sendDefaultEvent: false } } });
    service.handleMcpAnalyticsEvent(STATUS_EVENT);

    expect(sent).toEqual([{ uid: 'u1', name: DEFAULT_MCP_ANALYTICS_EVENT_NAME, data: { tool: 'demo_api_status', toolKind: 'static', call: 'demo_api_status', modelType: 'app', specifier: '', method: '', routed: false, success: true, reason: '' } }]);
  });

  it('should not send the default event when sendDefaultEvent is false', () => {
    const { service, sent } = makeService({ tools: { demo_api_status: { sendDefaultEvent: false } } });
    service.handleMcpAnalyticsEvent(STATUS_EVENT);
    expect(sent).toEqual([]);
  });

  it('should merge an object defaultEventData over the default data', () => {
    const { service, sent } = makeService({ tools: { demo_api_status: { defaultEventData: { toolGroup: 'status', reason: 'overridden' } } } });
    service.handleMcpAnalyticsEvent(STATUS_EVENT);
    expect(sent[0].data).toMatchObject({ tool: 'demo_api_status', toolGroup: 'status', reason: 'overridden' });
  });

  it('should send the data a defaultEventData function returns', () => {
    const { service, sent } = makeService({ tools: { 'docs-read': { defaultEventData: (_data, event) => ({ only: event.method ?? '' }) } } });
    service.handleMcpAnalyticsEvent(DOCS_READ_EVENT);
    expect(sent).toEqual([{ uid: 'u1', name: DEFAULT_MCP_ANALYTICS_EVENT_NAME, data: { only: 'docs-read' } }]);
  });

  it('should send the events onComplete sends, after the default event', () => {
    const { service, sent } = makeService({
      tools: {
        'docs.read': {
          onComplete: (emitter, event) => {
            emitter.sendEvent('Docs Read', { id: String(event.args?.['id']) });
            emitter.sendEvent('Docs Read Again');
          }
        }
      }
    });
    service.handleMcpAnalyticsEvent(DOCS_READ_EVENT);

    expect(sent.map((x) => x.name)).toEqual([DEFAULT_MCP_ANALYTICS_EVENT_NAME, 'Docs Read', 'Docs Read Again']);
    expect(sent[1]).toEqual({ uid: 'u1', name: 'Docs Read', data: { id: 'welcome' } });
    expect(sent[2].data).toEqual({});
  });

  it('should keep the other events and log a warning when a hook throws', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, sent } = makeService({
      tools: {
        demo_api_status: {
          defaultEventData: () => {
            throw new Error('bad data');
          },
          onComplete: (emitter) => {
            emitter.sendEvent('Before Throw');
            throw new Error('bad hook');
          }
        }
      }
    });
    service.handleMcpAnalyticsEvent(STATUS_EVENT);

    expect(sent.map((x) => x.name)).toEqual([DEFAULT_MCP_ANALYTICS_EVENT_NAME, 'Before Throw']);
    expect(sent[0].data).toMatchObject({ tool: 'demo_api_status' });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('should log when the default event is off and which events were sent', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service } = makeService({ logEvents: true, tools: { 'docs.read': { sendDefaultEvent: false, onComplete: (emitter) => emitter.sendEvent('Docs Read') } } });
    service.handleMcpAnalyticsEvent(DOCS_READ_EVENT);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('(default event off) sent: Docs Read');
  });

  describe('mcpToolAnalyticsKeys()', () => {
    it('should list the method, the dispatch key, then the tool name', () => {
      expect(mcpToolAnalyticsKeys(DOCS_READ_EVENT)).toEqual(['docs-read', 'docs.read', 'demo_api_read']);
    });

    it('should leave out the default specifier and keep a named one', () => {
      expect(mcpToolAnalyticsKeys({ ...STATUS_EVENT, toolName: 'guestbook-create', modelType: 'guestbook', call: 'create', specifier: '_' })).toEqual(['guestbook.create', 'guestbook-create']);
      expect(mcpToolAnalyticsKeys({ ...STATUS_EVENT, toolName: 'x', modelType: 'guestbook', call: 'update', specifier: 'reopen' })).toEqual(['guestbook.update.reopen', 'x']);
    });

    it('should not repeat a key', () => {
      expect(mcpToolAnalyticsKeys({ ...STATUS_EVENT, method: 'demo_api_status', routed: true })).toEqual(['demo_api_status', 'app.demo_api_status']);
    });
  });

  describe('findMcpToolAnalyticsConfig()', () => {
    it('should pick the most specific key that has a config', () => {
      const methodConfig = { sendDefaultEvent: false };
      const dispatchConfig = { sendDefaultEvent: true };
      const routerConfig = { defaultEventData: { router: true } };

      expect(findMcpToolAnalyticsConfig({ 'docs.read': dispatchConfig, demo_api_read: routerConfig }, DOCS_READ_EVENT)).toBe(dispatchConfig);
      expect(findMcpToolAnalyticsConfig({ 'docs-read': methodConfig, 'docs.read': dispatchConfig }, DOCS_READ_EVENT)).toBe(methodConfig);
      expect(findMcpToolAnalyticsConfig({ demo_api_read: routerConfig }, DOCS_READ_EVENT)).toBe(routerConfig);
      expect(findMcpToolAnalyticsConfig(undefined, DOCS_READ_EVENT)).toBeUndefined();
    });
  });
});
