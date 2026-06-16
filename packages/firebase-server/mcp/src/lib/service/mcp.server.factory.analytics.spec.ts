import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { McpServerFactoryService } from './mcp.server.factory';
import { MCP_MANIFEST_VERSION } from './mcp.manifest';
import { DEFAULT_MCP_SERVER_INSTRUCTIONS, type McpModuleConfig } from '../mcp.config';
import { type McpAnalyticsEvent, type McpAnalyticsService } from './analytics/mcp.analytics.handler';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { type ModelApiDetailsResult, type FirebaseServerAuthData } from '@dereekb/firebase-server';

function makeSchemaRef(name: string) {
  return {
    toJsonSchema: () => ({ type: 'object', title: name })
  };
}

function makeMcpConfig(overrides: Partial<McpModuleConfig> = {}): McpModuleConfig {
  return {
    oidcIssuer: 'https://example.test/oidc',
    mcpUrl: 'https://example.test/mcp',
    serverName: 'test-mcp',
    serverVersion: '0.0.1',
    ...overrides
  };
}

function makeDispatchService(apiDetails: ModelApiDetailsResult, dispatch: (params: OnCallTypedModelParams) => unknown) {
  return {
    getApiDetails: () => apiDetails,
    dispatch: async (params: OnCallTypedModelParams) => dispatch(params)
  } as any;
}

function makeApiDetails(spec: ReadonlyArray<{ model: string; call: string; specifier?: string; mcp?: object }>): ModelApiDetailsResult {
  const models: Record<string, { calls: Record<string, { isSpecifier: boolean; specifiers: Record<string, object> }> }> = {};

  for (const entry of spec) {
    const modelEntry = (models[entry.model] ??= { calls: {} });
    const callEntry = (modelEntry.calls[entry.call] ??= { isSpecifier: entry.specifier != null, specifiers: {} });
    const key = entry.specifier ?? '_';
    callEntry.specifiers[key] = { inputType: makeSchemaRef(`${entry.model}-${entry.call}-${key}`), mcp: entry.mcp };
  }

  return { models };
}

function makeManifestModelsPath(): string {
  const path = join(mkdtempSync(join(tmpdir(), 'mcp-analytics-')), 'mcp.manifest.json');
  writeFileSync(
    path,
    JSON.stringify({
      version: MCP_MANIFEST_VERSION,
      generatedAt: '2026-05-25T00:00:00.000Z',
      tools: {},
      models: [
        {
          modelType: 'guestbook',
          modelName: 'Guestbook',
          identityConst: 'guestbookIdentity',
          collectionPrefix: 'gb',
          sourcePackage: 'demo-firebase',
          sourceFile: 'guestbook.ts',
          modelGroup: 'Guestbook',
          fields: [{ name: 'n', longName: 'name', optional: false, tsType: 'string' }]
        }
      ]
    })
  );
  return path;
}

function firebaseAuth(uid = 'firebase-user-1'): FirebaseServerAuthData {
  return { uid, token: { uid } as any } as any;
}

function capturingAnalytics(): { service: McpAnalyticsService; events: McpAnalyticsEvent[] } {
  const events: McpAnalyticsEvent[] = [];
  return { service: { handleMcpAnalyticsEvent: (event) => events.push(event) }, events };
}

function makeFactory(apiDetails: ModelApiDetailsResult, options: { config?: Partial<McpModuleConfig>; dispatch?: (params: OnCallTypedModelParams) => unknown; analytics?: McpAnalyticsService } = {}): McpServerFactoryService {
  return new McpServerFactoryService(makeMcpConfig(options.config), makeDispatchService(apiDetails, options.dispatch ?? (() => ({ ok: true }))), undefined, undefined, options.analytics);
}

async function callTool(factory: McpServerFactoryService, name: string, options: { args?: Record<string, unknown>; auth?: FirebaseServerAuthData } = {}): Promise<{ isError?: boolean }> {
  const server = factory.createServer({ rawRequest: {} as any, auth: options.auth });
  const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
  const callHandler = handlers.get(CallToolRequestSchema.shape.method.value)!;
  return (await callHandler({ method: 'tools/call', params: { name, arguments: options.args ?? {} } }, {} as any)) as { isError?: boolean };
}

describe('McpServerFactoryService MCP analytics', () => {
  it('emits a single successful completion event for a callModel tool', async () => {
    const { service, events } = capturingAnalytics();
    const apiDetails = makeApiDetails([{ model: 'storageFile', call: 'invoke', specifier: 'recomputeChecksums' }]);
    const factory = makeFactory(apiDetails, { analytics: service });

    await callTool(factory, 'storageFile-recomputeChecksums', { args: { foo: 1 }, auth: firebaseAuth('u1') });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ toolName: 'storageFile-recomputeChecksums', toolKind: 'callModel', call: 'invoke', modelType: 'storageFile', specifier: 'recomputeChecksums', uid: 'u1', args: { foo: 1 }, isSuccessful: true });
    expect(events[0].error).toBeUndefined();
    expect(typeof events[0].durationMs).toBe('number');
    expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits a successful event with no error and the args payload', async () => {
    const { service, events } = capturingAnalytics();
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { analytics: service });

    await callTool(factory, 'guestbook-query');

    expect(events).toHaveLength(1);
    expect(events[0].isSuccessful).toBe(true);
    expect(events[0].error).toBeUndefined();
    expect(events[0].specifier).toBeUndefined();
    expect(events[0].modelType).toBe('guestbook');
  });

  it('emits a single successful completion event with toolKind "static" for a static tool', async () => {
    const { service, events } = capturingAnalytics();
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: makeManifestModelsPath() }, analytics: service });

    const result = await callTool(factory, 'model-info', { auth: firebaseAuth() });

    expect(result.isError).toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ toolName: 'model-info', toolKind: 'static', isSuccessful: true });
  });

  it('emits a single failed completion event and forwards the thrown error', async () => {
    const { service, events } = capturingAnalytics();
    const boom = new Error('dispatch boom');
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }]), {
      analytics: service,
      dispatch: () => {
        throw boom;
      }
    });

    const result = await callTool(factory, 'guestbook-create');

    expect(result.isError).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].isSuccessful).toBe(false);
    expect(events[0].error).toBe(boom);
  });

  it('emits a single failed completion event for an unknown tool', async () => {
    const { service, events } = capturingAnalytics();
    const factory = makeFactory({ models: {} }, { analytics: service });

    const result = await callTool(factory, 'missing-tool');

    expect(result.isError).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ toolName: 'missing-tool', toolKind: 'static', call: undefined, modelType: undefined, isSuccessful: false });
  });

  it('is fail-soft: a throwing analytics handler does not break dispatch and logs a warning', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const throwingService: McpAnalyticsService = {
      handleMcpAnalyticsEvent: () => {
        throw new Error('analytics down');
      }
    };
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { analytics: throwingService, dispatch: () => ({ ran: true }) });

    try {
      const result = (await callTool(factory, 'guestbook-query')) as { isError?: boolean; structuredContent?: unknown };
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ ran: true });
      expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('MCP analytics handler threw'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('works with no analytics service registered (noop fallback)', async () => {
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { dispatch: () => ({ ran: true }) });
    const result = (await callTool(factory, 'guestbook-query')) as { isError?: boolean; structuredContent?: unknown };
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ ran: true });
  });

  it('reports readOnly mode on emitted events', async () => {
    const { service, events } = capturingAnalytics();
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { readOnly: true }, analytics: service });

    await callTool(factory, 'guestbook-query');
    expect(events.every((e) => e.readOnly === true)).toBe(true);
  });
});

describe('McpServerFactoryService MCP analytics reason parameter', () => {
  it('strips the reason from the dispatched callModel body and forwards it on the event', async () => {
    const { service, events } = capturingAnalytics();
    let receivedParams: OnCallTypedModelParams | undefined;
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }]), {
      analytics: service,
      dispatch: (params) => {
        receivedParams = params;
        return { ok: true };
      }
    });

    await callTool(factory, 'guestbook-create', { args: { foo: 1, reason: 'creating a guestbook entry' }, auth: firebaseAuth('u1') });

    expect(receivedParams?.data).toEqual({ foo: 1 });
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe('creating a guestbook entry');
    expect(events[0].args).toEqual({ foo: 1 });
  });

  it('clamps the forwarded reason at 250 chars', async () => {
    const { service, events } = capturingAnalytics();
    const long = 'y'.repeat(300);
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }]), { analytics: service });

    await callTool(factory, 'guestbook-create', { args: { reason: long } });

    expect(events[0].reason).toHaveLength(250);
  });

  it('does not strip or forward reason when reasonParameter is false', async () => {
    const { service, events } = capturingAnalytics();
    let receivedParams: OnCallTypedModelParams | undefined;
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }]), {
      config: { reasonParameter: false },
      analytics: service,
      dispatch: (params) => {
        receivedParams = params;
        return { ok: true };
      }
    });

    await callTool(factory, 'guestbook-create', { args: { foo: 1, reason: 'kept in body' } });

    // Disabled: the field is treated as a normal arg and reaches the handler untouched.
    expect(receivedParams?.data).toEqual({ foo: 1, reason: 'kept in body' });
    expect(events[0].reason).toBeUndefined();
  });

  it('passes a handler-owned reason through to the body and does not forward it on the event', async () => {
    const { service, events } = capturingAnalytics();
    let receivedParams: OnCallTypedModelParams | undefined;
    const ownSchema = { type: 'object', properties: { reason: { type: 'string' } } };
    const apiDetails = { models: { widget: { calls: { create: { isSpecifier: false, specifiers: { _: { inputType: { toJsonSchema: () => ownSchema } } } } } } } } as unknown as ModelApiDetailsResult;
    const factory = makeFactory(apiDetails, {
      analytics: service,
      dispatch: (params) => {
        receivedParams = params;
        return { ok: true };
      }
    });

    await callTool(factory, 'widget-create', { args: { reason: 'handler-owned' } });

    expect(receivedParams?.data).toEqual({ reason: 'handler-owned' });
    expect(events[0].reason).toBeUndefined();
  });
});

describe('McpServerFactoryService configurable instructions', () => {
  it('uses the default instructions when serverInstructions is unset', () => {
    const factory = makeFactory({ models: {} });
    const server = factory.createServer({ rawRequest: {} as any });
    const instructions = (server.server as any)._instructions as string;
    expect(instructions).toBe(DEFAULT_MCP_SERVER_INSTRUCTIONS);
  });

  it('uses the serverInstructions override when provided', () => {
    const factory = makeFactory({ models: {} }, { config: { serverInstructions: 'custom instructions text' } });
    const server = factory.createServer({ rawRequest: {} as any });
    const instructions = (server.server as any)._instructions as string;
    expect(instructions).toBe('custom instructions text');
  });
});
