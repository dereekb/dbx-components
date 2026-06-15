import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { McpServerFactoryService } from './mcp.server.factory';
import { MCP_MANIFEST_VERSION } from './mcp.manifest';
import { type McpModuleConfig, type McpAuthRoleReader } from '../mcp.config';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { type ModelApiDetailsResult, type FirebaseServerAuthData, type McpToolVisibility, type McpVisibilityContext, type McpToolDetailsBuilder, type McpToolDetailsBuilderInput } from '@dereekb/firebase-server';
import { AUTH_ADMIN_ROLE, type AuthRoleSet } from '@dereekb/util';

function makeSchemaRef(name: string) {
  return {
    toJsonSchema: () => ({ type: 'object', title: name })
  };
}

function makeManifestTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'mcp-manifest-'));
}

function writeManifest(content: object): string {
  const path = join(makeManifestTempDir(), 'mcp.manifest.json');
  writeFileSync(path, JSON.stringify(content));
  return path;
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

function makeFactory(apiDetails: ModelApiDetailsResult, options: { config?: Partial<McpModuleConfig>; roleReader?: McpAuthRoleReader; dispatch?: (params: OnCallTypedModelParams) => unknown } = {}): McpServerFactoryService {
  return new McpServerFactoryService(makeMcpConfig(options.config), makeDispatchService(apiDetails, options.dispatch ?? (() => ({ ok: true }))), undefined, options.roleReader);
}

type WireToolEntry = { name: string; description: string; inputSchema: object; outputSchema?: object; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } };

async function listToolEntries(factory: McpServerFactoryService, ctx: { auth?: FirebaseServerAuthData; rawRequest?: any } = {}): Promise<ReadonlyArray<WireToolEntry>> {
  const server = factory.createServer({ rawRequest: ctx.rawRequest ?? ({} as any), auth: ctx.auth });
  const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<{ tools: ReadonlyArray<WireToolEntry> }>>;
  const result = await handlers.get(ListToolsRequestSchema.shape.method.value)!({ method: 'tools/list', params: {} }, {} as any);
  return result.tools;
}

async function listTools(factory: McpServerFactoryService, ctx: { auth?: FirebaseServerAuthData; rawRequest?: any } = {}): Promise<ReadonlyArray<{ name: string; description?: string }>> {
  const server = factory.createServer({ rawRequest: ctx.rawRequest ?? ({} as any), auth: ctx.auth });
  const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<{ tools: ReadonlyArray<{ name: string; description?: string }> }>>;
  const listHandler = handlers.get(ListToolsRequestSchema.shape.method.value)!;
  const result = await listHandler({ method: 'tools/list', params: {} }, {} as any);
  return result.tools;
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

function oidcAuth(scopes: string, roles?: AuthRoleSet): FirebaseServerAuthData {
  return {
    uid: 'user-1',
    token: { uid: 'user-1' } as any,
    oidcValidatedToken: { sub: 'user-1', scope: scopes },
    ...(roles ? { _roles: roles } : {})
  } as any;
}

function firebaseAuth(claims: Record<string, unknown> = {}): FirebaseServerAuthData {
  return {
    uid: 'firebase-user-1',
    token: { uid: 'firebase-user-1', ...claims } as any
  } as any;
}

describe('McpServerFactoryService.createServer', () => {
  it('registers tools/list and returns one tool per generated definition', async () => {
    const apiDetails = makeApiDetails([{ model: 'storageFile', call: 'invoke', specifier: 'recomputeChecksums' }]);
    const tools = await listTools(makeFactory(apiDetails));
    expect(tools.map((t) => t.name)).toEqual(['storageFile-recomputeChecksums']);
  });

  it('routes tools/call back through the dispatch service with the right params', async () => {
    let receivedParams: OnCallTypedModelParams | undefined;
    const apiDetails = makeApiDetails([{ model: 'storageFile', call: 'invoke', specifier: 'recomputeChecksums' }]);
    const factory = makeFactory(apiDetails, {
      dispatch: (params) => {
        receivedParams = params;
        return { ran: true };
      }
    });

    const server = factory.createServer({ rawRequest: {} as any });
    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const callHandler = handlers.get(CallToolRequestSchema.shape.method.value)!;

    const callResult = (await callHandler(
      {
        method: 'tools/call',
        params: { name: 'storageFile-recomputeChecksums', arguments: { foo: 1 } }
      },
      {} as any
    )) as { isError?: boolean; structuredContent?: unknown };

    expect(callResult.isError).toBeUndefined();
    expect(callResult.structuredContent).toEqual({ ran: true });
    expect(receivedParams).toEqual({ call: 'invoke', modelType: 'storageFile', specifier: 'recomputeChecksums', data: { foo: 1 } });
  });

  it('returns an isError response when the tool name is unknown', async () => {
    const factory = makeFactory({ models: {} });
    const server = factory.createServer({ rawRequest: {} as any });
    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const callHandler = handlers.get(CallToolRequestSchema.shape.method.value)!;

    const result = (await callHandler({ method: 'tools/call', params: { name: 'missing-tool', arguments: {} } }, {} as any)) as { isError?: boolean; content: ReadonlyArray<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Unknown tool');
  });
});

describe('McpServerFactoryService scope filter', () => {
  const apiDetails = makeApiDetails([
    { model: 'guestbook', call: 'read' },
    { model: 'guestbook', call: 'create' },
    { model: 'guestbook', call: 'update' },
    { model: 'guestbook', call: 'delete' },
    { model: 'guestbook', call: 'query' }
  ]);

  it('drops tools whose required scope the OIDC caller lacks', async () => {
    const factory = makeFactory(apiDetails);
    const tools = await listTools(factory, { auth: oidcAuth('model.read') });
    expect(tools.map((t) => t.name).sort((a, b) => a.localeCompare(b))).toEqual(['guestbook-read']);
  });

  it('keeps tools whose required scope the OIDC caller holds', async () => {
    const factory = makeFactory(apiDetails);
    const tools = await listTools(factory, { auth: oidcAuth('model.read model.create model.update model.delete model.query') });
    expect(tools.map((t) => t.name).sort((a, b) => a.localeCompare(b))).toEqual(['guestbook-create', 'guestbook-delete', 'guestbook-query', 'guestbook-read', 'guestbook-update']);
  });

  it('bypasses scope filtering when the caller has no OIDC scope claim', async () => {
    const factory = makeFactory(apiDetails);
    const tools = await listTools(factory, { auth: firebaseAuth() });
    expect(tools).toHaveLength(5);
  });

  it('bypasses scope filtering for anonymous callers', async () => {
    const factory = makeFactory(apiDetails);
    const tools = await listTools(factory);
    expect(tools).toHaveLength(5);
  });
});

describe('McpServerFactoryService visibility filter', () => {
  it('hides visibility:false tools and keeps visibility:true tools subject to scope', async () => {
    const apiDetails = makeApiDetails([
      { model: 'widget', call: 'read', specifier: 'hidden', mcp: { visibility: false satisfies McpToolVisibility } },
      { model: 'widget', call: 'read', specifier: 'shown', mcp: { visibility: true satisfies McpToolVisibility } }
    ]);

    const allScopes = await listTools(makeFactory(apiDetails), { auth: oidcAuth('model.read') });
    expect(allScopes.map((t) => t.name).sort((a, b) => a.localeCompare(b))).toEqual(['widget-shown']);

    const noScopes = await listTools(makeFactory(apiDetails), { auth: oidcAuth('') });
    expect(noScopes.map((t) => t.name)).toEqual([]);
  });

  it('applies declarative requireAuthenticated', async () => {
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', mcp: { visibility: { requireAuthenticated: true } satisfies McpToolVisibility } }]);
    const factory = makeFactory(apiDetails);

    expect((await listTools(factory)).map((t) => t.name)).toEqual([]);
    expect((await listTools(factory, { auth: firebaseAuth() })).map((t) => t.name)).toEqual(['widget-read']);
  });

  it('checks declarative requiredRoles via the role reader', async () => {
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', mcp: { visibility: { requiredRoles: [AUTH_ADMIN_ROLE] } satisfies McpToolVisibility } }]);

    const roleReader: McpAuthRoleReader = (claims) => new Set<string>(claims['a'] === true ? [AUTH_ADMIN_ROLE] : []);

    const factory = makeFactory(apiDetails, { roleReader });
    expect((await listTools(factory, { auth: firebaseAuth({ a: true }) })).map((t) => t.name)).toEqual(['widget-read']);
    expect((await listTools(factory, { auth: firebaseAuth({ a: false }) })).map((t) => t.name)).toEqual([]);
  });

  it('fails closed with one warning when requiredRoles is declared but no role reader is provided', async () => {
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', mcp: { visibility: { requiredRoles: [AUTH_ADMIN_ROLE] } satisfies McpToolVisibility } }]);
    const factory = makeFactory(apiDetails);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    try {
      expect((await listTools(factory, { auth: firebaseAuth() })).map((t) => t.name)).toEqual([]);
      expect((await listTools(factory, { auth: firebaseAuth() })).map((t) => t.name)).toEqual([]);

      const matched = warnSpy.mock.calls.filter(([message]) => typeof message === 'string' && message.includes('McpAuthRoleReader'));
      expect(matched).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('invokes dynamic predicate with the request context', async () => {
    const received: McpVisibilityContext[] = [];
    const fn = (ctx: McpVisibilityContext): boolean => {
      received.push(ctx);
      return ctx.auth?.uid === 'firebase-user-1';
    };

    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', mcp: { visibility: fn satisfies McpToolVisibility } }]);
    const factory = makeFactory(apiDetails);

    expect((await listTools(factory, { auth: firebaseAuth() })).map((t) => t.name)).toEqual(['widget-read']);
    expect((await listTools(factory)).map((t) => t.name)).toEqual([]);
    expect(received[0]?.tool).toEqual({ call: 'read', modelType: 'widget', specifier: undefined });
  });

  it('treats a throwing dynamic predicate as not visible and logs a warning', async () => {
    const fn = (): boolean => {
      throw new Error('boom');
    };
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', mcp: { visibility: fn as unknown as McpToolVisibility } }]);
    const factory = makeFactory(apiDetails);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    try {
      expect((await listTools(factory, { auth: firebaseAuth() })).map((t) => t.name)).toEqual([]);
      expect(warnSpy.mock.calls.some(([message]) => typeof message === 'string' && message.includes('visibility predicate threw'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('McpServerFactoryService readOnly mode', () => {
  const apiDetails = makeApiDetails([
    { model: 'guestbook', call: 'read' },
    { model: 'guestbook', call: 'query' },
    { model: 'guestbook', call: 'create' },
    { model: 'guestbook', call: 'update' },
    { model: 'guestbook', call: 'delete' },
    { model: 'guestbook', call: 'invoke' }
  ]);

  it('keeps only reads/queries when readOnly is true', async () => {
    const factory = makeFactory(apiDetails, { config: { readOnly: true } });
    const tools = await listTools(factory);
    expect(tools.map((t) => t.name).sort((a, b) => a.localeCompare(b))).toEqual(['guestbook-query', 'guestbook-read']);
  });

  it('drops unknown-classification (invoke) tools as a fail-safe when readOnly is true', async () => {
    const factory = makeFactory(apiDetails, { config: { readOnly: true } });
    const tools = await listTools(factory);
    expect(tools.find((t) => t.name === 'guestbook-invoke')).toBeUndefined();
  });

  it('honors the explicit handler readOnly override under readOnly mode', async () => {
    const apiDetailsOverride = makeApiDetails([
      { model: 'widget', call: 'invoke', specifier: 'safe', mcp: { readOnly: true } },
      { model: 'widget', call: 'read', specifier: 'risky', mcp: { readOnly: false } }
    ]);
    const factory = makeFactory(apiDetailsOverride, { config: { readOnly: true } });
    const tools = await listTools(factory);
    expect(tools.map((t) => t.name).sort((a, b) => a.localeCompare(b))).toEqual(['widget-safe']);
  });

  it('appends " (read-only)" to the advertised serverName when readOnly is true', () => {
    const factory = makeFactory({ models: {} }, { config: { readOnly: true, serverName: 'demo-mcp' } });
    const server = factory.createServer({ rawRequest: {} as any });
    const info = (server.server as any)._serverInfo as { name: string };
    expect(info.name).toBe('demo-mcp (read-only)');
  });

  it('keeps the serverName unchanged when readOnly is false or absent', () => {
    const factory = makeFactory({ models: {} }, { config: { serverName: 'demo-mcp' } });
    const server = factory.createServer({ rawRequest: {} as any });
    const info = (server.server as any)._serverInfo as { name: string };
    expect(info.name).toBe('demo-mcp');
  });
});

describe('McpServerFactoryService manifest loader', () => {
  it('warns and falls back when mcpManifestPath points at a missing file', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: join(makeManifestTempDir(), 'missing-manifest.json') } });

    try {
      const tools = await listTools(factory);
      expect(tools.map((t) => t.name)).toEqual(['guestbook-query']);
      expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('the file is missing'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('warns and falls back when the manifest version does not match', async () => {
    const path = writeManifest({ version: 999, generatedAt: '2026-05-25T00:00:00.000Z', tools: {} });
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });

    try {
      const tools = await listTools(factory);
      expect(tools.map((t) => t.name)).toEqual(['guestbook-query']);
      expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('version mismatch'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('loads a valid manifest and exposes pre-rendered description + outputSchema on tools/list', async () => {
    const path = writeManifest({
      version: MCP_MANIFEST_VERSION,
      generatedAt: '2026-05-25T00:00:00.000Z',
      tools: {
        'guestbook.query._': {
          description: 'Pre-rendered query description.',
          outputSchema: { type: 'object', properties: { count: { type: 'number' } } }
        }
      }
    });
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });

    try {
      const server = factory.createServer({ rawRequest: {} as any });
      const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<{ tools: ReadonlyArray<{ name: string; description?: string; outputSchema?: object }> }>>;
      const result = await handlers.get(ListToolsRequestSchema.shape.method.value)!({ method: 'tools/list', params: {} }, {} as any);

      const tool = result.tools.find((t) => t.name === 'guestbook-query');
      expect(tool?.description).toBe('Pre-rendered query description.');
      expect(tool?.outputSchema).toEqual({ type: 'object', properties: { count: { type: 'number' } } });
      expect(logSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('1 tool entries'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('McpServerFactoryService model catalog tools', () => {
  const MODEL_ENTRY = {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
    modelGroup: 'Guestbook',
    fields: [{ name: 'n', longName: 'name', optional: false, tsType: 'string' }]
  };

  it('does not register model-info / model-decode when the manifest is absent', async () => {
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]));
    const tools = await listTools(factory);
    expect(tools.map((t) => t.name)).not.toContain('model-info');
    expect(tools.map((t) => t.name)).not.toContain('model-decode');
  });

  it('does not register model-info / model-decode when the manifest has no models', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {} });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const tools = await listTools(factory);
    expect(tools.map((t) => t.name)).not.toContain('model-info');
    expect(tools.map((t) => t.name)).not.toContain('model-decode');
  });

  it('registers model-info and model-decode when the manifest carries a non-empty models[] array', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [MODEL_ENTRY] });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const tools = await listTools(factory, { auth: firebaseAuth() });
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['model-info', 'model-decode']));
  });

  const ENUM_BLOCK = { GuestbookState: { name: 'GuestbookState', values: [{ name: 'OPEN', value: 1 }] } };

  it('registers enum-info when the manifest carries a non-empty enums block', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [MODEL_ENTRY], enums: ENUM_BLOCK });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const tools = await listTools(factory, { auth: firebaseAuth() });
    expect(tools.map((t) => t.name)).toContain('enum-info');
  });

  it('does not register enum-info when the manifest carries no enums', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [MODEL_ENTRY] });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const tools = await listTools(factory, { auth: firebaseAuth() });
    expect(tools.map((t) => t.name)).not.toContain('enum-info');
  });

  it('registers enum-info even when the manifest has enums but no models', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, enums: ENUM_BLOCK });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const tools = await listTools(factory, { auth: firebaseAuth() });
    expect(tools.map((t) => t.name)).toContain('enum-info');
    expect(tools.map((t) => t.name)).not.toContain('model-info');
  });

  it('hides enum-info from unauthenticated callers', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, enums: ENUM_BLOCK });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const tools = await listTools(factory);
    expect(tools.map((t) => t.name)).not.toContain('enum-info');
  });

  it('hides model-info and model-decode from unauthenticated callers', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [MODEL_ENTRY] });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const tools = await listTools(factory);
    expect(tools.map((t) => t.name)).not.toContain('model-info');
    expect(tools.map((t) => t.name)).not.toContain('model-decode');
  });

  it('logs the model entry count alongside the tool entry count on boot', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [MODEL_ENTRY] });
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });

    try {
      await listTools(factory, { auth: firebaseAuth() });
      expect(logSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('1 model entries'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('answers tools/call for model-info in groups mode by default, and list mode for all:true', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [MODEL_ENTRY] });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const server = factory.createServer({ rawRequest: {} as any, auth: firebaseAuth() });
    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const callHandler = handlers.get(CallToolRequestSchema.shape.method.value)!;

    const groups = (await callHandler({ method: 'tools/call', params: { name: 'model-info', arguments: {} } }, {} as any)) as { isError?: boolean; structuredContent?: { mode?: string; groups?: ReadonlyArray<{ modelGroup: string; modelCount: number }>; totalModels?: number } };

    expect(groups.isError).toBeUndefined();
    expect(groups.structuredContent?.mode).toBe('groups');
    expect(groups.structuredContent?.groups).toEqual([{ modelGroup: 'Guestbook', modelCount: 1 }]);
    expect(groups.structuredContent?.totalModels).toBe(1);

    const list = (await callHandler({ method: 'tools/call', params: { name: 'model-info', arguments: { all: true } } }, {} as any)) as { isError?: boolean; structuredContent?: { mode?: string; models?: ReadonlyArray<{ modelType: string }> } };

    expect(list.isError).toBeUndefined();
    expect(list.structuredContent?.mode).toBe('list');
    expect(list.structuredContent?.models?.map((m) => m.modelType)).toEqual(['guestbook']);
  });

  it('answers tools/call for model-decode against a registered prefix', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [MODEL_ENTRY] });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });
    const server = factory.createServer({ rawRequest: {} as any, auth: firebaseAuth() });
    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const callHandler = handlers.get(CallToolRequestSchema.shape.method.value)!;

    const result = (await callHandler({ method: 'tools/call', params: { name: 'model-decode', arguments: { key: 'gb/abc' } } }, {} as any)) as { isError?: boolean; structuredContent?: { leaf?: { modelType?: string } } };

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.leaf?.modelType).toBe('guestbook');
  });
});

describe('McpServerFactoryService toolDetails builder', () => {
  it('overrides description when the builder returns one', async () => {
    const toolDetails: McpToolDetailsBuilder = () => ({ description: 'dynamic description from builder' });
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', specifier: 'enriched', mcp: { toolDetails } }]);

    const tools = await listToolEntries(makeFactory(apiDetails));
    expect(tools[0]?.description).toBe('dynamic description from builder');
  });

  it('overrides inputSchema when the builder returns one (default not present)', async () => {
    const overrideSchema = { type: 'object', properties: { override: { type: 'string', enum: ['x'] } } };
    const toolDetails: McpToolDetailsBuilder = () => ({ inputSchema: overrideSchema });
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', specifier: 'enriched', mcp: { toolDetails } }]);

    // Disable the auto-injected reason parameter so this test isolates the builder override behaviour
    // (with reason enabled the override schema is additionally wrapped — covered by the reason suite).
    const tools = await listToolEntries(makeFactory(apiDetails, { config: { reasonParameter: false } }));
    expect(tools[0]?.inputSchema).toEqual(overrideSchema);
    expect((tools[0]?.inputSchema as { title?: string }).title).toBeUndefined();
  });

  it('falls back to defaults and warns when the builder throws', async () => {
    const toolDetails: McpToolDetailsBuilder = () => {
      throw new Error('boom');
    };
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', specifier: 'broken', mcp: { toolDetails } }]);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    try {
      const tools = await listToolEntries(makeFactory(apiDetails));
      expect(tools[0]?.description).toContain('Performs the "read" call');
      expect((tools[0]?.inputSchema as { title?: string }).title).toBe('widget-read-broken');
      expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('toolDetails builder threw'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('passes the per-request auth and scopes to the builder', async () => {
    const received: McpToolDetailsBuilderInput[] = [];
    const toolDetails: McpToolDetailsBuilder = (input) => {
      received.push(input);
      return {};
    };
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', mcp: { toolDetails } }]);
    const factory = makeFactory(apiDetails);

    await listToolEntries(factory, { auth: oidcAuth('model.read') });
    expect(received).toHaveLength(1);
    expect(received[0]?.auth?.uid).toBe('user-1');
    expect(received[0]?.scopes?.has('model.read')).toBe(true);
    expect(received[0]?.dispatch).toEqual({ call: 'read', modelType: 'widget', specifier: undefined });
  });

  it('reuses the same frozen staticWireEntry across requests for tools without a builder (reason disabled)', async () => {
    // The frozen-verbatim hot path only holds when the auto-injected reason parameter is disabled;
    // with it enabled the inputSchema is wrapped per request (covered by the reason-parameter suite).
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read' }]);
    const factory = makeFactory(apiDetails, { config: { reasonParameter: false } });

    const firstCall = await listToolEntries(factory);
    const secondCall = await listToolEntries(factory);
    expect(firstCall[0]).toBe(secondCall[0]);
    expect(Object.isFrozen(firstCall[0])).toBe(true);
  });

  it('does not invoke builders for tools that did not opt in', async () => {
    const optInBuilder = vi.fn<McpToolDetailsBuilder>(() => ({ description: 'enriched' }));
    const apiDetails = makeApiDetails([
      { model: 'widget', call: 'read', specifier: 'static' },
      { model: 'widget', call: 'read', specifier: 'enriched', mcp: { toolDetails: optInBuilder } }
    ]);
    const factory = makeFactory(apiDetails);

    await listToolEntries(factory);
    expect(optInBuilder).toHaveBeenCalledTimes(1);
    expect(optInBuilder.mock.calls[0]?.[0]?.dispatch).toEqual({ call: 'read', modelType: 'widget', specifier: 'enriched' });
  });
});

describe('McpServerFactoryService tool annotations', () => {
  it('advertises read/write annotations on the static tools/list wire path', async () => {
    const apiDetails = makeApiDetails([
      { model: 'guestbook', call: 'read' },
      { model: 'guestbook', call: 'update' }
    ]);
    const tools = await listToolEntries(makeFactory(apiDetails));

    const readTool = tools.find((t) => t.name === 'guestbook-read');
    expect(readTool?.annotations).toEqual({ readOnlyHint: true });
    expect(readTool?.description.startsWith('[WRITE] ')).toBe(false);

    const updateTool = tools.find((t) => t.name === 'guestbook-update');
    expect(updateTool?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true });
    expect(updateTool?.description.startsWith('[WRITE] ')).toBe(true);
  });

  it('carries annotations through the dynamic toolDetails wire path', async () => {
    const toolDetails: McpToolDetailsBuilder = () => ({ description: 'enriched action' });
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'invoke', specifier: 'doThing', mcp: { toolDetails } }]);
    const tools = await listToolEntries(makeFactory(apiDetails));
    expect(tools[0]?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true });
  });
});

describe('McpServerFactoryService filtered-out tool dispatch', () => {
  it('returns "Unknown tool" when a hidden tool is invoked via tools/call', async () => {
    const apiDetails = makeApiDetails([{ model: 'widget', call: 'read', mcp: { visibility: false satisfies McpToolVisibility } }]);
    const factory = makeFactory(apiDetails);
    const server = factory.createServer({ rawRequest: {} as any });
    const handlers = (server.server as any)._requestHandlers as Map<string, (request: any, extra: any) => Promise<unknown>>;
    const callHandler = handlers.get(CallToolRequestSchema.shape.method.value)!;

    const result = (await callHandler({ method: 'tools/call', params: { name: 'widget-read', arguments: {} } }, {} as any)) as { isError?: boolean; content: ReadonlyArray<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Unknown tool');
  });
});

describe('McpServerFactoryService reason parameter', () => {
  const REASON_MODEL_ENTRY = {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    sourcePackage: 'demo-firebase',
    sourceFile: 'guestbook.ts',
    modelGroup: 'Guestbook',
    fields: [{ name: 'n', longName: 'name', optional: false, tsType: 'string' }]
  };

  type ReasonSchema = { type?: string; properties?: Record<string, { type?: string; maxLength?: number; description?: string }>; required?: ReadonlyArray<string> };

  it('adds a required reason (string, maxLength 250) to a generated tool by default', async () => {
    const tools = await listToolEntries(makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }])));
    const schema = tools.find((t) => t.name === 'guestbook-create')?.inputSchema as ReasonSchema;

    expect(schema.properties?.reason).toEqual({ type: 'string', maxLength: 250, description: expect.any(String) });
    expect(schema.required).toContain('reason');
  });

  it('adds a required reason to a static built-in tool (model-info) by default', async () => {
    const path = writeManifest({ version: MCP_MANIFEST_VERSION, generatedAt: '2026-05-25T00:00:00.000Z', tools: {}, models: [REASON_MODEL_ENTRY] });
    const factory = makeFactory(makeApiDetails([{ model: 'guestbook', call: 'query' }]), { config: { mcpManifestPath: path } });

    const tools = await listToolEntries(factory, { auth: firebaseAuth() });
    const schema = tools.find((t) => t.name === 'model-info')?.inputSchema as ReasonSchema;

    expect(schema.properties?.reason).toMatchObject({ type: 'string', maxLength: 250 });
    expect(schema.required).toContain('reason');
  });

  it('omits the reason parameter when reasonParameter is false', async () => {
    const tools = await listToolEntries(makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }]), { config: { reasonParameter: false } }));
    const schema = tools.find((t) => t.name === 'guestbook-create')?.inputSchema as ReasonSchema;
    expect(schema.properties?.reason).toBeUndefined();
    expect(schema.required ?? []).not.toContain('reason');
  });

  it('honors a custom parameterName and maxLength override', async () => {
    const tools = await listToolEntries(makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }]), { config: { reasonParameter: { parameterName: 'justification', maxLength: 80 } } }));
    const schema = tools.find((t) => t.name === 'guestbook-create')?.inputSchema as ReasonSchema;
    expect(schema.properties?.justification).toMatchObject({ type: 'string', maxLength: 80 });
    expect(schema.properties?.reason).toBeUndefined();
    expect(schema.required).toContain('justification');
  });

  it('does not mark the parameter required when required is false', async () => {
    const tools = await listToolEntries(makeFactory(makeApiDetails([{ model: 'guestbook', call: 'create' }]), { config: { reasonParameter: { required: false } } }));
    const schema = tools.find((t) => t.name === 'guestbook-create')?.inputSchema as ReasonSchema;
    expect(schema.properties?.reason).toBeDefined();
    expect(schema.required ?? []).not.toContain('reason');
  });

  it('does not double-declare reason for a tool whose schema already declares it', async () => {
    const ownSchema = { type: 'object', properties: { reason: { type: 'string', description: 'handler-owned' } } };
    const apiDetails = { models: { widget: { calls: { create: { isSpecifier: false, specifiers: { _: { inputType: { toJsonSchema: () => ownSchema } } } } } } } } as unknown as ModelApiDetailsResult;

    const tools = await listToolEntries(makeFactory(apiDetails));
    const schema = tools.find((t) => t.name === 'widget-create')?.inputSchema as ReasonSchema;

    expect(schema.properties?.reason).toEqual({ type: 'string', description: 'handler-owned' });
    expect(schema.required ?? []).not.toContain('reason');
  });
});
