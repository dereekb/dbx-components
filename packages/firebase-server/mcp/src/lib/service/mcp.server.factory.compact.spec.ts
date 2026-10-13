import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { type FirebaseServerAuthData, type McpToolDetailsBuilder, type McpToolVisibility, type ModelApiDetailsResult } from '@dereekb/firebase-server';
import { AUTH_ADMIN_ROLE, type Maybe } from '@dereekb/util';
import { type McpAdditionalTools, type McpAuthRoleReader, type McpModuleConfig } from '../mcp.config';
import { type McpAnalyticsEvent } from './analytics/mcp.analytics.handler';
import { mcpAdditionalTool } from './mcp.compact';
import { MCP_MANIFEST_VERSION } from './mcp.manifest';
import { McpServerFactoryService } from './mcp.server.factory';
import { dispatchMcpDiscover, dispatchMcpMethodCall, dispatchMcpToolCall, dispatchMcpToolsList, type McpSpecDriverContext } from './mcp.spec-driver';

type WireToolEntry = { name: string; description: string; inputSchema: { properties?: Record<string, unknown> }; annotations?: { readOnlyHint?: boolean }; _meta?: Record<string, unknown> };
type ToolResult = { isError?: boolean; content: ReadonlyArray<{ text: string }>; structuredContent?: any };

function makeApiDetails(spec: ReadonlyArray<{ model: string; call: string; specifier?: string; mcp?: object }>): ModelApiDetailsResult {
  const models: Record<string, { calls: Record<string, { isSpecifier: boolean; specifiers: Record<string, object> }> }> = {};

  for (const entry of spec) {
    const modelEntry = (models[entry.model] ??= { calls: {} });
    const callEntry = (modelEntry.calls[entry.call] ??= { isSpecifier: entry.specifier != null, specifiers: {} });
    const key = entry.specifier ?? '_';
    callEntry.specifiers[key] = { inputType: { toJsonSchema: () => ({ type: 'object', properties: { name: { type: 'string', description: `${entry.model} name` } } }) }, mcp: entry.mcp };
  }

  return { models } as unknown as ModelApiDetailsResult;
}

const ADMIN_ONLY: McpToolVisibility = { requiredRoles: [AUTH_ADMIN_ROLE] };

const API_DETAILS = makeApiDetails([
  { model: 'guestbook', call: 'create' },
  { model: 'guestbook', call: 'read' },
  { model: 'guestbook', call: 'query' },
  { model: 'guestbook', call: 'update', specifier: 'reopen' },
  { model: 'secretLedger', call: 'update', specifier: 'rebalance', mcp: { visibility: ADMIN_ONLY } }
]);

const roleReader: McpAuthRoleReader = (claims) => new Set<string>(claims['a'] === true ? [AUTH_ADMIN_ROLE] : []);

interface MakeFactoryOptions {
  readonly config?: Partial<McpModuleConfig>;
  readonly apiDetails?: ModelApiDetailsResult;
  readonly dispatch?: (params: OnCallTypedModelParams) => unknown;
  readonly events?: McpAnalyticsEvent[];
  readonly additional?: McpAdditionalTools;
  readonly getService?: unknown;
  readonly storage?: unknown;
  readonly minter?: unknown;
  readonly docs?: unknown;
}

function makeFactory(options: MakeFactoryOptions = {}): McpServerFactoryService {
  const config = { oidcIssuer: 'https://example.test/oidc', mcpUrl: 'https://example.test/mcp', serverName: 'demo-api-mcp', serverVersion: '0.0.1', ...options.config } as McpModuleConfig;
  const apiDetails = options.apiDetails ?? API_DETAILS;
  const dispatchService = { getApiDetails: () => apiDetails, dispatch: async (params: OnCallTypedModelParams) => (options.dispatch ?? (() => ({ ok: true })))(params) } as any;
  const analytics = options.events == null ? undefined : { handleMcpAnalyticsEvent: (event: McpAnalyticsEvent) => options.events?.push(event) };
  return new McpServerFactoryService(config, dispatchService, options.getService as any, roleReader, analytics, options.storage as any, undefined, options.minter as any, options.additional, options.docs as any);
}

function firebaseAuth(claims: Record<string, unknown> = {}): FirebaseServerAuthData {
  return { uid: 'user-1', token: { uid: 'user-1', ...claims } as any } as any;
}

const USER: McpSpecDriverContext = { auth: firebaseAuth() };
const ADMIN: McpSpecDriverContext = { auth: firebaseAuth({ a: true }) };

async function listNames(factory: McpServerFactoryService, ctx: McpSpecDriverContext = USER): Promise<string[]> {
  return (await dispatchMcpToolsList<WireToolEntry>(factory, ctx)).map((x) => x.name);
}

async function search(factory: McpServerFactoryService, ctx: McpSpecDriverContext, args: Record<string, unknown>): Promise<{ total: number; methods: { method: string; kind: string; params: string[] }[] }> {
  const result = await dispatchMcpToolCall<ToolResult>({ factory, ctx, name: factory.compactToolNames.search, args });
  return result.structuredContent;
}

describe('McpServerFactoryService compact surface', () => {
  describe('tools/list', () => {
    it('should list only the compact tools by default', async () => {
      expect(await listNames(makeFactory())).toEqual(['demo_mcp_search', 'demo_mcp_details', 'demo_mcp_read', 'demo_mcp_write']);
    });

    it('should mark the compact tools alwaysLoad and merge meta overrides', async () => {
      const factory = makeFactory({ config: { tools: { meta: { write: { 'anthropic/requiresUserInteraction': true } } } } });
      const entries = await dispatchMcpToolsList<WireToolEntry>(factory, USER);
      expect(entries.every((x) => x._meta?.['anthropic/alwaysLoad'] === true)).toBe(true);
      expect(entries.find((x) => x.name === 'demo_mcp_write')?._meta?.['anthropic/requiresUserInteraction']).toBe(true);
    });

    it('should omit the reason parameter only from search and details', async () => {
      const entries = await dispatchMcpToolsList<WireToolEntry>(makeFactory(), USER);
      const byName = new Map(entries.map((x) => [x.name, x]));
      expect(byName.get('demo_mcp_search')?.inputSchema.properties?.['reason']).toBeUndefined();
      expect(byName.get('demo_mcp_details')?.inputSchema.properties?.['reason']).toBeUndefined();
      expect(byName.get('demo_mcp_read')?.inputSchema.properties?.['reason']).toBeDefined();
      expect(byName.get('demo_mcp_write')?.inputSchema.properties?.['reason']).toBeDefined();
    });

    it('should drop the write tool in read-only mode', async () => {
      expect(await listNames(makeFactory({ config: { readOnly: true } }))).toEqual(['demo_mcp_search', 'demo_mcp_details', 'demo_mcp_read']);
    });

    it('should use the configured prefix and name overrides', async () => {
      const factory = makeFactory({ config: { toolNamePrefix: 'app', tools: { names: { search: 'find_app_methods' } } } });
      expect(await listNames(factory)).toEqual(['find_app_methods', 'app_mcp_details', 'app_mcp_read', 'app_mcp_write']);
    });

    it('should list the compact tools and the per-method tools in BOTH mode without duplicates', async () => {
      const entries = await dispatchMcpToolsList<WireToolEntry>(makeFactory({ config: { tools: { methodTools: true } } }), USER);
      const names = entries.map((x) => x.name);
      expect(names.slice(0, 4)).toEqual(['demo_mcp_search', 'demo_mcp_details', 'demo_mcp_read', 'demo_mcp_write']);
      expect(names).toContain('guestbook-create');
      expect(new Set(names).size).toBe(names.length);
      expect(entries.find((x) => x.name === 'guestbook-create')?._meta).toBeUndefined();
    });

    it('should mark list-promoted methods alwaysLoad', async () => {
      const entries = await dispatchMcpToolsList<WireToolEntry>(makeFactory({ config: { tools: { methodTools: ['guestbook.read'] } } }), USER);
      expect(entries.find((x) => x.name === 'guestbook-read')?._meta?.['anthropic/alwaysLoad']).toBe(true);
      expect(entries.map((x) => x.name)).not.toContain('guestbook-create');
    });

    it('should append the usage block to the instructions', async () => {
      const discover = await dispatchMcpDiscover(makeFactory({ config: { serverInstructions: 'Custom.' } }), USER);
      expect(discover.instructions?.startsWith('Custom.\n\n')).toBe(true);
      expect(discover.instructions).toContain('demo_mcp_search');
    });

    it('should skip the usage block when instructions is false', async () => {
      const discover = await dispatchMcpDiscover(makeFactory({ config: { serverInstructions: 'Custom.', tools: { instructions: false } } }), USER);
      expect(discover.instructions).toBe('Custom.');
    });
  });

  describe('search and details', () => {
    it('should find methods by keyword', async () => {
      const result = await search(makeFactory(), USER, { query: 'reopen guestbook' });
      expect(result.methods.map((x) => x.method)).toEqual(['guestbook.update.reopen']);
      expect(result.methods[0].kind).toBe('write');
      expect(result.methods[0].params).toEqual(['name']);
    });

    it('should filter by kind and list a model with an empty query', async () => {
      const result = await search(makeFactory(), USER, { query: '', model: 'guestbook', kind: 'read' });
      expect(result.methods.map((x) => x.method)).toEqual(['guestbook.read', 'guestbook.query']);
    });

    it('should return the details of a method by alias', async () => {
      const factory = makeFactory();
      const result = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_mcp_details', args: { method: 'guestbook-create' } });
      expect(result.structuredContent.method).toBe('guestbook.create');
      expect(result.structuredContent.invokeWith).toBe('demo_mcp_write');
      expect(result.structuredContent.tool).toBeUndefined();
      expect(result.structuredContent.inputSchema.properties.reason).toBeUndefined();
    });

    it('should run the details builder without the reason parameter', async () => {
      const toolDetails: McpToolDetailsBuilder = () => ({ description: 'Built per request.' });
      const factory = makeFactory({ apiDetails: makeApiDetails([{ model: 'widget', call: 'read', mcp: { toolDetails } }]) });
      const result = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_mcp_details', args: { method: 'widget.read' } });
      expect(result.structuredContent.description).toBe('Built per request.');
      expect(result.structuredContent.inputSchema.properties.reason).toBeUndefined();
    });
  });

  describe('routing', () => {
    it('should run a write method through write', async () => {
      let received: OnCallTypedModelParams | undefined;
      const factory = makeFactory({
        dispatch: (params) => {
          received = params;
          return { created: true };
        }
      });

      const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'guestbook.create', params: { name: 'x' } });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ created: true });
      expect(received).toEqual({ call: 'create', modelType: 'guestbook', specifier: undefined, data: { name: 'x' } });
    });

    it('should parse JSON-string params', async () => {
      let received: OnCallTypedModelParams | undefined;
      const factory = makeFactory({ dispatch: (params) => (received = params) });
      await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'read', method: 'guestbook.read', params: '{"name":"y"}' });
      expect(received?.data).toEqual({ name: 'y' });
    });

    it('should return an array result from a read method', async () => {
      const factory = makeFactory({ dispatch: () => [{ id: 1 }, { id: 2 }] });
      const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'read', method: 'guestbook.query', params: {} });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('"id": 2');
    });

    it('should refuse a write method through read', async () => {
      const result = await dispatchMcpMethodCall<ToolResult>({ factory: makeFactory(), ctx: USER, kind: 'read', method: 'guestbook.create', params: {} });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('call `demo_mcp_write`');
    });

    it('should refuse extra top-level arguments', async () => {
      const result = await dispatchMcpMethodCall<ToolResult>({ factory: makeFactory(), ctx: USER, kind: 'read', method: 'guestbook.read', extraArgs: { name: 'x' } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('`params`');
    });

    it('should suggest visible methods for an unknown method', async () => {
      const result = await dispatchMcpMethodCall<ToolResult>({ factory: makeFactory(), ctx: USER, kind: 'write', method: 'guestbook.reopen', params: {} });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('guestbook.update.reopen');
    });

    it('should hint the compact call for a legacy tool name', async () => {
      const result = await dispatchMcpToolCall<ToolResult>({ factory: makeFactory(), ctx: USER, name: 'guestbook-create' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("call `demo_mcp_write` with `method: 'guestbook.create'`");
    });
  });

  describe('hidden methods', () => {
    it('should run an admin-only method for an admin', async () => {
      const result = await dispatchMcpMethodCall<ToolResult>({ factory: makeFactory(), ctx: ADMIN, kind: 'write', method: 'secretLedger.update.rebalance', params: {} });
      expect(result.isError).toBeUndefined();
    });

    it('should treat an admin-only method as unknown for a non-admin', async () => {
      const factory = makeFactory();
      const write = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'secretLedger.update.rebalance', params: {} });
      expect(write.isError).toBe(true);
      expect(write.content[0].text).not.toContain('secretLedger.update.rebalance`');
      expect(write.content[0].text).not.toContain('is a write method');

      const read = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'read', method: 'secretLedger.update.rebalance', params: {} });
      expect(read.content[0].text).not.toContain('is a write method');

      const details = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_mcp_details', args: { method: 'secretLedger.update.rebalance' } });
      expect(details.isError).toBe(true);

      const found = await search(factory, USER, { query: 'rebalance ledger', mode: 'any' });
      expect(found.total).toBe(0);
      expect((await search(factory, ADMIN, { query: 'rebalance ledger' })).total).toBe(1);
    });
  });

  describe('analytics', () => {
    it('should describe the executed method and the inner reason', async () => {
      const events: McpAnalyticsEvent[] = [];
      const factory = makeFactory({ events });
      await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'guestbook-create', params: { name: 'x', reason: 'inner' } });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ toolName: 'demo_mcp_write', toolKind: 'callModel', call: 'create', modelType: 'guestbook', method: 'guestbook.create', routed: true, args: { name: 'x' }, reason: 'inner', isSuccessful: true });
    });

    it('should prefer the outer reason and record an unresolved method', async () => {
      const events: McpAnalyticsEvent[] = [];
      const factory = makeFactory({ events });
      await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'nope.create', params: {}, extraArgs: { reason: 'outer' } });

      expect(events[0]).toMatchObject({ toolName: 'demo_mcp_write', toolKind: 'static', routed: true, requestedMethod: 'nope.create', reason: 'outer', isSuccessful: false });
      expect(events[0].method).toBeUndefined();
    });
  });

  describe('additional tools', () => {
    const additional: McpAdditionalTools = [
      mcpAdditionalTool({ name: 'demo_report', description: 'A demo report.', readOnly: true, expose: 'tool', handler: () => ({ total: 3 }) }),
      mcpAdditionalTool({ name: 'demo_recount', description: 'Recounts the demo totals.', readOnly: false, expose: 'method', handler: () => ({ recounted: true }) })
    ];

    it('should list tool exposures and route method exposures', async () => {
      const factory = makeFactory({ additional });
      expect(await listNames(factory)).toEqual(['demo_mcp_search', 'demo_mcp_details', 'demo_mcp_read', 'demo_mcp_write', 'demo_report']);

      const report = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_report' });
      expect(report.structuredContent).toEqual({ total: 3 });

      const recount = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'demo_recount' });
      expect(recount.structuredContent).toEqual({ recounted: true });
    });
  });

  describe('batch-execute', () => {
    it('should be a write method in compact mode and a listed tool in legacy mode', async () => {
      const storage = {};
      const compactFound = await search(makeFactory({ storage }), USER, { query: 'batch' });
      expect(compactFound.methods.map((x) => x.method)).toContain('batch-execute');

      const legacy = await listNames(makeFactory({ storage, config: { tools: { compact: false, methodTools: true } } }));
      expect(legacy[legacy.length - 1]).toBe('batch-execute');
    });
  });

  describe('documentation', () => {
    function makeDocsService(docCount = 2) {
      const reads: { id: string; section?: string }[] = [];
      const service = {
        docCount,
        requiredScope: undefined,
        reads,
        // admins see both docs, other callers one, and callers flagged `noDocs` none
        countVisibleDocs: (auth: Maybe<FirebaseServerAuthData>) => (auth == null || auth.token['noDocs'] === true ? 0 : auth.token['a'] === true ? 2 : 1),
        searchDocs: (_auth: unknown, params: { query: string }) => ({ total: 1, results: [{ id: 'welcome', title: 'Welcome', snippet: params.query }] }),
        readDoc: (_auth: unknown, params: { id: string; section?: string }) => {
          reads.push(params);
          return { id: params.id, title: 'Welcome', content: '# Welcome' };
        }
      };
      return service;
    }

    it('should list the documentation tool for callers who can see a doc', async () => {
      const factory = makeFactory({ docs: makeDocsService() });
      expect(factory.compactToolNames.documentation).toBe('search_demo_documentation');
      expect(await listNames(factory)).toEqual(['demo_mcp_search', 'demo_mcp_details', 'demo_mcp_read', 'demo_mcp_write', 'search_demo_documentation']);
      expect(await listNames(factory, { auth: firebaseAuth({ noDocs: true }) })).not.toContain('search_demo_documentation');
    });

    it('should search docs without a reason parameter', async () => {
      const factory = makeFactory({ docs: makeDocsService() });
      const entry = (await dispatchMcpToolsList<WireToolEntry>(factory, USER)).find((x) => x.name === 'search_demo_documentation');
      expect(entry?.inputSchema.properties?.['reason']).toBeUndefined();
      expect(entry?._meta?.['anthropic/alwaysLoad']).toBe(true);

      const result = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'search_demo_documentation', args: { query: 'setup' } });
      expect(result.structuredContent.results[0].snippet).toBe('setup');
    });

    it('should read a doc through the docs-read method', async () => {
      const docs = makeDocsService();
      const factory = makeFactory({ docs });
      const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'read', method: 'docs-read', params: { id: 'welcome', section: 'intro' } });
      expect(result.isError).not.toBe(true);
      expect(docs.reads).toEqual([{ id: 'welcome', section: 'intro' }]);
    });

    it('should mention the documentation tool in the instructions', async () => {
      const discover = await dispatchMcpDiscover(makeFactory({ docs: makeDocsService() }), USER);
      expect(discover.instructions).toContain('search_demo_documentation');
    });

    it('should leave docs off when no doc was loaded', async () => {
      const factory = makeFactory({ docs: makeDocsService(0) });
      expect(await listNames(factory)).not.toContain('search_demo_documentation');
      expect((await search(factory, USER, { query: 'docs' })).methods.map((x) => x.method)).not.toContain('docs-read');
      expect((await dispatchMcpDiscover(factory, USER)).instructions).not.toContain('search_demo_documentation');
    });

    it('should list the documentation and docs-read tools in legacy mode', async () => {
      const names = await listNames(makeFactory({ docs: makeDocsService(), config: { tools: { compact: false, methodTools: true } } }));
      expect(names).toContain('search_demo_documentation');
      expect(names).toContain('docs-read');
    });
  });

  describe('legacy mode', () => {
    it('should keep the per-method names, order, and instructions', async () => {
      const manifestPath = join(mkdtempSync(join(tmpdir(), 'mcp-compact-')), 'mcp.manifest.json');
      writeFileSync(
        manifestPath,
        JSON.stringify({
          version: MCP_MANIFEST_VERSION,
          generatedAt: '2026-10-12T00:00:00.000Z',
          tools: {},
          models: [{ modelType: 'guestbook', modelName: 'Guestbook', identityConst: 'guestbookIdentity', collectionPrefix: 'gb', sourcePackage: 'demo-firebase', sourceFile: 'guestbook.ts', fields: [] }],
          enums: { GuestbookState: { name: 'GuestbookState', values: [] } },
          auth: { apps: [], claims: [] }
        })
      );

      const getService = { readDocuments: async () => [], getModelIdentity: () => undefined, readRoleMaps: async () => [] };
      const minter = () => ({ claimCode: 'c', claimExpiresAt: '', expiresAt: '', scope: '' });
      const factory = makeFactory({ getService, storage: {}, minter, config: { serverInstructions: 'Custom.', mcpManifestPath: manifestPath, tools: { compact: false, methodTools: true } } });

      const entries = await dispatchMcpToolsList<WireToolEntry>(factory, ADMIN);
      expect(entries.map((x) => x.name)).toEqual(['guestbook-create', 'guestbook-read', 'guestbook-query', 'guestbook-reopen', 'secretLedger-rebalance', 'model-get', 'model-roles', 'model-info', 'model-decode', 'enum-info', 'whoami', 'cli-token', 'batch-execute']);
      expect(entries.some((x) => x._meta != null)).toBe(false);
      expect(factory.compactToolNames.token).toBe('cli-token');
      expect((await dispatchMcpDiscover(factory, ADMIN)).instructions).toBe('Custom.');
    });
  });
});
