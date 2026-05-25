import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { McpServerFactoryService } from './mcp.server.factory';
import { MCP_MANIFEST_VERSION } from './mcp.manifest';
import { type McpModuleConfig, type McpAuthRoleReader } from '../mcp.config';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { type ModelApiDetailsResult, type FirebaseServerAuthData, type McpToolVisibility, type McpVisibilityContext } from '@dereekb/firebase-server';
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
  return new McpServerFactoryService(makeMcpConfig(options.config), makeDispatchService(apiDetails, options.dispatch ?? (() => ({ ok: true }))), options.roleReader);
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
    expect(tools.map((t) => t.name)).toEqual(['storageFile-invoke-recomputeChecksums']);
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
        params: { name: 'storageFile-invoke-recomputeChecksums', arguments: { foo: 1 } }
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
    expect(allScopes.map((t) => t.name).sort((a, b) => a.localeCompare(b))).toEqual(['widget-read-shown']);

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
    expect(tools.map((t) => t.name).sort((a, b) => a.localeCompare(b))).toEqual(['widget-invoke-safe']);
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
