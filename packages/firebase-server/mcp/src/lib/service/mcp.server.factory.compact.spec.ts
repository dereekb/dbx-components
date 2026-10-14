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
import { MCP_COMPACT_SEARCH_NO_MATCH_HINT, MCP_COMPACT_SEARCH_PARTIAL_HINT } from './tools/mcp.tool.compact-search';
import { dispatchMcpDiscover, dispatchMcpMethodCall, dispatchMcpToolCall, dispatchMcpToolsList, type McpSpecDriverContext } from './mcp.spec-driver';

type WireToolEntry = { name: string; description: string; inputSchema: { properties?: Record<string, unknown> }; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean }; _meta?: Record<string, unknown> };
type ToolResult = { isError?: boolean; content: ReadonlyArray<{ text: string }>; structuredContent?: any };

function makeApiDetails(spec: ReadonlyArray<{ model: string; call: string; specifier?: string; mcp?: object; properties?: Record<string, object> }>): ModelApiDetailsResult {
  const models: Record<string, { calls: Record<string, { isSpecifier: boolean; specifiers: Record<string, object> }> }> = {};

  for (const entry of spec) {
    const modelEntry = (models[entry.model] ??= { calls: {} });
    const callEntry = (modelEntry.calls[entry.call] ??= { isSpecifier: entry.specifier != null, specifiers: {} });
    const key = entry.specifier ?? '_';
    callEntry.specifiers[key] = { inputType: { toJsonSchema: () => ({ type: 'object', properties: { name: { type: 'string', description: `${entry.model} name` }, ...entry.properties } }) }, mcp: entry.mcp };
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

const CHECK_ENTRY = { model: 'guestbook', call: 'invoke', specifier: 'check', mcp: { destructive: false, escalatingParams: { probe: { openWorld: true } } }, properties: { probe: { type: 'boolean', description: 'Send a real probe.' } } };

/**
 * {@link API_DETAILS} plus a write method whose `probe` param makes a call destructive.
 */
const ESCALATING_API_DETAILS = makeApiDetails([
  { model: 'guestbook', call: 'create' },
  { model: 'guestbook', call: 'read' },
  { model: 'guestbook', call: 'query' },
  { model: 'guestbook', call: 'update', specifier: 'reopen' },
  { model: 'secretLedger', call: 'update', specifier: 'rebalance', mcp: { visibility: ADMIN_ONLY } },
  CHECK_ENTRY
]);

/**
 * Methods named like the demo guestbook ones, for the keyword-search cases.
 */
const SEARCH_API_DETAILS = makeApiDetails([
  { model: 'guestbook', call: 'create' },
  { model: 'guestbook', call: 'query' },
  { model: 'guestbook', call: 'update', specifier: 'subscribeToNotifications' },
  { model: 'guestbookEntry', call: 'delete' },
  { model: 'guestbookEntry', call: 'update', specifier: 'insert' },
  { model: 'guestbookEntry', call: 'update', specifier: 'like' },
  { model: 'secretLedger', call: 'delete', mcp: { visibility: ADMIN_ONLY } }
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

async function search(factory: McpServerFactoryService, ctx: McpSpecDriverContext, args: Record<string, unknown>): Promise<{ total: number; partial?: true; hint?: string; methods: { method: string; kind: string; params: string[]; escalatingParams?: Record<string, string> }[] }> {
  const result = await dispatchMcpToolCall<ToolResult>({ factory, ctx, name: factory.compactToolNames.search, args });
  return result.structuredContent;
}

describe('McpServerFactoryService compact surface', () => {
  describe('tools/list', () => {
    it('should list only the compact tools by default', async () => {
      expect(await listNames(makeFactory())).toEqual(['demo_api_search', 'demo_api_details', 'demo_api_read', 'demo_api_write', 'demo_api_destructive']);
    });

    it('should mark the compact tools alwaysLoad and merge meta overrides', async () => {
      const factory = makeFactory({ config: { tools: { meta: { write: { 'anthropic/requiresUserInteraction': true }, destructive: { 'test/flag': true } } } } });
      const entries = await dispatchMcpToolsList<WireToolEntry>(factory, USER);
      expect(entries.every((x) => x._meta?.['anthropic/alwaysLoad'] === true)).toBe(true);
      expect(entries.find((x) => x.name === 'demo_api_write')?._meta?.['anthropic/requiresUserInteraction']).toBe(true);
      expect(entries.find((x) => x.name === 'demo_api_destructive')?._meta?.['test/flag']).toBe(true);
    });

    it('should annotate and mark the write and destructive routers', async () => {
      const entries = await dispatchMcpToolsList<WireToolEntry>(makeFactory(), USER);
      const write = entries.find((x) => x.name === 'demo_api_write');
      const destructive = entries.find((x) => x.name === 'demo_api_destructive');
      expect(write?.annotations).toEqual({ readOnlyHint: false, destructiveHint: false });
      expect(write?.description.startsWith('[WRITE] ')).toBe(true);
      expect(destructive?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
      expect(destructive?.description.startsWith('[DESTRUCTIVE] ')).toBe(true);
    });

    it('should only list the routers a visible method can use', async () => {
      const createsOnly = makeFactory({ apiDetails: makeApiDetails([{ model: 'guestbook', call: 'create' }]) });
      expect(await listNames(createsOnly)).not.toContain('demo_api_destructive');
      expect(await listNames(createsOnly)).toContain('demo_api_write');

      const readsOnly = makeFactory({ apiDetails: makeApiDetails([{ model: 'guestbook', call: 'read' }]) });
      expect(await listNames(readsOnly)).toEqual(['demo_api_search', 'demo_api_details', 'demo_api_read']);

      const escalatingOnly = makeFactory({ apiDetails: makeApiDetails([CHECK_ENTRY]) });
      expect(await listNames(escalatingOnly)).toEqual(['demo_api_search', 'demo_api_details', 'demo_api_write', 'demo_api_destructive']);
    });

    it('should omit the reason parameter only from search and details', async () => {
      const entries = await dispatchMcpToolsList<WireToolEntry>(makeFactory(), USER);
      const byName = new Map(entries.map((x) => [x.name, x]));
      expect(byName.get('demo_api_search')?.inputSchema.properties?.['reason']).toBeUndefined();
      expect(byName.get('demo_api_details')?.inputSchema.properties?.['reason']).toBeUndefined();
      expect(byName.get('demo_api_read')?.inputSchema.properties?.['reason']).toBeDefined();
      expect(byName.get('demo_api_write')?.inputSchema.properties?.['reason']).toBeDefined();
      expect(byName.get('demo_api_destructive')?.inputSchema.properties?.['reason']).toBeDefined();
    });

    it('should drop the write tool in read-only mode', async () => {
      expect(await listNames(makeFactory({ config: { readOnly: true } }))).toEqual(['demo_api_search', 'demo_api_details', 'demo_api_read']);
    });

    it('should use the configured prefix and name overrides', async () => {
      const factory = makeFactory({ config: { toolNamePrefix: 'app', tools: { names: { search: 'find_app_methods' } } } });
      expect(await listNames(factory)).toEqual(['find_app_methods', 'app_api_details', 'app_api_read', 'app_api_write', 'app_api_destructive']);
    });

    it('should list the compact tools and the per-method tools in BOTH mode without duplicates', async () => {
      const entries = await dispatchMcpToolsList<WireToolEntry>(makeFactory({ config: { tools: { methodTools: true } } }), USER);
      const names = entries.map((x) => x.name);
      expect(names.slice(0, 5)).toEqual(['demo_api_search', 'demo_api_details', 'demo_api_read', 'demo_api_write', 'demo_api_destructive']);
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
      expect(discover.instructions).toContain('demo_api_search');
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
      expect(result.methods[0].kind).toBe('destructive');
      expect(result.methods[0].params).toEqual(['name']);
    });

    describe('keywords', () => {
      const factory = makeFactory({ apiDetails: SEARCH_API_DETAILS });

      it('should drop filler words from a sentence-like query', async () => {
        const result = await search(factory, USER, { query: 'subscribe me to guestbook notifications' });
        expect(result.methods.map((x) => x.method)).toEqual(['guestbook.update.subscribeToNotifications']);
        expect(result.partial).toBeUndefined();
        expect(result.hint).toBeUndefined();
      });

      it('should find a delete method by the word remove', async () => {
        const result = await search(factory, USER, { query: 'remove my entry from guestbook' });
        expect(result.methods.map((x) => x.method)).toEqual(['guestbookEntry.delete']);
        expect(result.partial).toBeUndefined();
      });

      it('should rank the like method first for "like an entry"', async () => {
        const result = await search(factory, USER, { query: 'like an entry' });
        expect(result.methods[0].method).toBe('guestbookEntry.update.like');
        expect(result.partial).toBeUndefined();
      });

      it('should fall back to methods matching some keywords, with a hint', async () => {
        const result = await search(factory, USER, { query: 'like guestbook calendar' });
        expect(result.partial).toBe(true);
        expect(result.hint).toBe(MCP_COMPACT_SEARCH_PARTIAL_HINT);
        expect(result.methods[0].method).toBe('guestbookEntry.update.like');
      });

      it('should hint when nothing matches', async () => {
        const result = await search(factory, USER, { query: 'calendar' });
        expect(result.total).toBe(0);
        expect(result.partial).toBeUndefined();
        expect(result.hint).toBe(MCP_COMPACT_SEARCH_NO_MATCH_HINT);
      });

      it('should never fall back to a hidden method', async () => {
        const userResult = await search(factory, USER, { query: 'remove ledger' });
        expect(userResult.partial).toBe(true);
        expect(userResult.methods.map((x) => x.method)).toEqual(['guestbookEntry.delete']);

        const adminResult = await search(factory, ADMIN, { query: 'remove ledger' });
        expect(adminResult.partial).toBeUndefined();
        expect(adminResult.methods.map((x) => x.method)).toEqual(['secretLedger.delete']);
      });
    });

    it('should filter by kind and list a model with an empty query', async () => {
      const result = await search(makeFactory(), USER, { query: '', model: 'guestbook', kind: 'read' });
      expect(result.methods.map((x) => x.method)).toEqual(['guestbook.read', 'guestbook.query']);
    });

    it('should list every visible method of a kind with an empty query and only kind', async () => {
      const factory = makeFactory();
      const reads = await search(factory, USER, { query: '', kind: 'read', limit: 50 });
      const readIds = reads.methods.map((x) => x.method);
      expect(readIds).toEqual(expect.arrayContaining(['guestbook.read', 'guestbook.query']));
      expect(reads.methods.every((x) => x.kind === 'read')).toBe(true);
      expect(reads.total).toBe(reads.methods.length);

      const writes = await search(factory, USER, { query: '', kind: 'write', limit: 50 });
      const writeIds = writes.methods.map((x) => x.method);
      expect(writeIds).toContain('guestbook.create');
      expect(writeIds).not.toContain('guestbook.update.reopen');
      expect(writeIds).not.toContain('secretLedger.update.rebalance');
      expect(writes.methods.every((x) => x.kind === 'write')).toBe(true);

      const destructives = await search(factory, USER, { query: '', kind: 'destructive', limit: 50 });
      const destructiveIds = destructives.methods.map((x) => x.method);
      expect(destructiveIds).toContain('guestbook.update.reopen');
      expect(destructiveIds).not.toContain('secretLedger.update.rebalance');
      expect(destructiveIds).not.toContain('guestbook.create');
    });

    it('should list an escalating write method under both write and destructive', async () => {
      const factory = makeFactory({ apiDetails: ESCALATING_API_DETAILS });
      const writes = await search(factory, USER, { query: '', kind: 'write', limit: 50 });
      const destructives = await search(factory, USER, { query: '', kind: 'destructive', limit: 50 });
      const row = destructives.methods.find((x) => x.method === 'guestbook.invoke.check');
      expect(writes.methods.map((x) => x.method)).toContain('guestbook.invoke.check');
      expect(row?.kind).toBe('write');
      expect(row?.escalatingParams).toEqual({ probe: 'destructive' });
    });

    it('should count every match in total when the kind listing is limited', async () => {
      const factory = makeFactory();
      const all = await search(factory, USER, { query: '', kind: 'read', limit: 50 });
      const limited = await search(factory, USER, { query: '', kind: 'read', limit: 1 });
      expect(limited.methods).toHaveLength(1);
      expect(limited.total).toBe(all.total);
      expect(limited.total).toBeGreaterThan(1);
    });

    it('should return nothing for an empty query without a model or kind', async () => {
      const result = await search(makeFactory(), USER, { query: '' });
      expect(result.total).toBe(0);
      expect(result.methods).toEqual([]);
    });

    it('should return the details of a method by alias', async () => {
      const factory = makeFactory();
      const result = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_api_details', args: { method: 'guestbook-create' } });
      expect(result.structuredContent.method).toBe('guestbook.create');
      expect(result.structuredContent.invokeWith).toBe('demo_api_write');
      expect(result.structuredContent.tool).toBeUndefined();
      expect(result.structuredContent.inputSchema.properties.reason).toBeUndefined();
    });

    it('should point a destructive method at the destructive router', async () => {
      const result = await dispatchMcpToolCall<ToolResult>({ factory: makeFactory(), ctx: USER, name: 'demo_api_details', args: { method: 'guestbook.update.reopen' } });
      expect(result.structuredContent.kind).toBe('destructive');
      expect(result.structuredContent.invokeWith).toBe('demo_api_destructive');
      expect(result.structuredContent.escalatingParams).toBeUndefined();
    });

    it('should describe and mark escalating params', async () => {
      const factory = makeFactory({ apiDetails: ESCALATING_API_DETAILS });
      const first = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_api_details', args: { method: 'guestbook.invoke.check' } });
      const second = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_api_details', args: { method: 'guestbook.invoke.check' } });
      const details = first.structuredContent;
      expect(details.kind).toBe('write');
      expect(details.invokeWith).toBe('demo_api_write');
      expect(details.escalatingParams).toEqual({ probe: { kind: 'destructive', invokeWith: 'demo_api_destructive', hints: { openWorld: true } } });
      expect(details.inputSchema.properties.probe.description.startsWith('Send a real probe. ')).toBe(true);
      expect(details.inputSchema.properties.probe.description.endsWith('call `demo_api_destructive` when it is set.')).toBe(true);
      expect(details.inputSchema.properties.name.description).toBe('guestbook name');
      expect(details.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: true });
      expect(second.content[0].text).toBe(first.content[0].text);
    });

    it('should run the details builder without the reason parameter', async () => {
      const toolDetails: McpToolDetailsBuilder = () => ({ description: 'Built per request.' });
      const factory = makeFactory({ apiDetails: makeApiDetails([{ model: 'widget', call: 'read', mcp: { toolDetails } }]) });
      const result = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_api_details', args: { method: 'widget.read' } });
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
      expect(result.content[0].text).toContain('call `demo_api_write`');
    });

    it('should run a destructive method only through destructive', async () => {
      const factory = makeFactory();
      const ok = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'destructive', method: 'guestbook.update.reopen', params: {} });
      expect(ok.isError).toBeUndefined();

      for (const kind of ['write', 'read'] as const) {
        const refused = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind, method: 'guestbook.update.reopen', params: {} });
        expect(refused.isError).toBe(true);
        expect(refused.content[0].text).toContain('`guestbook.update.reopen` is a destructive method; call `demo_api_destructive`.');
      }
    });

    it('should refuse a write method through destructive', async () => {
      const result = await dispatchMcpMethodCall<ToolResult>({ factory: makeFactory(), ctx: USER, kind: 'destructive', method: 'guestbook.create', params: {} });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('is a write method; call `demo_api_write`');
    });

    describe('escalating params', () => {
      function makeEscalatingFactory() {
        const received: OnCallTypedModelParams[] = [];
        const factory = makeFactory({
          apiDetails: ESCALATING_API_DETAILS,
          dispatch: (params) => {
            received.push(params);
            return { ok: true };
          }
        });
        return { factory, received };
      }

      it('should refuse a call that sets an escalating param through write before dispatch', async () => {
        const { factory, received } = makeEscalatingFactory();
        const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'guestbook.invoke.check', params: { probe: true } });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Setting `probe` makes this call destructive; call `demo_api_destructive`.');
        expect(received).toHaveLength(0);
      });

      it('should refuse JSON-string params that set an escalating param through write', async () => {
        const { factory, received } = makeEscalatingFactory();
        const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'guestbook.invoke.check', params: '{"probe":true}' });
        expect(result.isError).toBe(true);
        expect(received).toHaveLength(0);
      });

      it('should run a call that sets an escalating param through destructive', async () => {
        const { factory, received } = makeEscalatingFactory();
        const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'destructive', method: 'guestbook.invoke.check', params: { probe: true } });
        expect(result.isError).toBeUndefined();
        const data = received[0]?.data as Maybe<Record<string, unknown>>;
        expect(data?.['probe']).toBe(true);
      });

      it('should refuse a plain call through destructive', async () => {
        const { factory, received } = makeEscalatingFactory();
        const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'destructive', method: 'guestbook.invoke.check', params: {} });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('`guestbook.invoke.check` is a write method unless `probe` is set; call `demo_api_write`.');
        expect(received).toHaveLength(0);
      });

      it('should run a plain call through write', async () => {
        const { factory, received } = makeEscalatingFactory();
        const unset = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'guestbook.invoke.check', params: { probe: false } });
        const reasonOnly = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'guestbook.invoke.check', params: { reason: 'x' } });
        expect(unset.isError).toBeUndefined();
        expect(reasonOnly.isError).toBeUndefined();
        expect(received).toHaveLength(2);
      });
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
      expect(result.content[0].text).toContain("call `demo_api_write` with `method: 'guestbook.create'`");
    });

    it('should hint the destructive router for a legacy tool name of a destructive method', async () => {
      const result = await dispatchMcpToolCall<ToolResult>({ factory: makeFactory(), ctx: USER, name: 'guestbook-reopen' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("call `demo_api_destructive` with `method: 'guestbook.update.reopen'`");
    });
  });

  describe('hidden methods', () => {
    it('should run an admin-only method for an admin', async () => {
      const result = await dispatchMcpMethodCall<ToolResult>({ factory: makeFactory(), ctx: ADMIN, kind: 'destructive', method: 'secretLedger.update.rebalance', params: {} });
      expect(result.isError).toBeUndefined();
    });

    it('should treat an admin-only method as unknown for a non-admin', async () => {
      const factory = makeFactory();

      for (const kind of ['read', 'write', 'destructive'] as const) {
        const result = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind, method: 'secretLedger.update.rebalance', params: {} });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unknown method');
        expect(result.content[0].text).not.toContain('secretLedger.update.rebalance`');
        expect(result.content[0].text).not.toContain(' method; call ');
      }

      const details = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_api_details', args: { method: 'secretLedger.update.rebalance' } });
      expect(details.isError).toBe(true);

      const found = await search(factory, USER, { query: 'rebalance ledger', mode: 'any' });
      expect(found.total).toBe(0);
      expect((await search(factory, ADMIN, { query: 'rebalance ledger' })).total).toBe(1);
    });
  });

  describe('examples', () => {
    const HIDDEN_FIRST_API_DETAILS = makeApiDetails([
      { model: 'secretLedger', call: 'update', specifier: 'rebalance', mcp: { visibility: ADMIN_ONLY } },
      { model: 'guestbook', call: 'create' },
      { model: 'guestbook', call: 'update', specifier: 'reopen' }
    ]);

    async function searchDescription(factory: McpServerFactoryService, ctx: McpSpecDriverContext): Promise<string> {
      const tools = await dispatchMcpToolsList<WireToolEntry>(factory, ctx);
      return tools.find((x) => x.name === factory.compactToolNames.search)?.description ?? '';
    }

    it('should never name a method the caller cannot see', async () => {
      const factory = makeFactory({ apiDetails: HIDDEN_FIRST_API_DETAILS });
      const userInstructions = (await dispatchMcpDiscover(factory, USER)).instructions ?? '';
      const adminInstructions = (await dispatchMcpDiscover(factory, ADMIN)).instructions ?? '';

      expect(userInstructions).toContain('e.g. `guestbook.update.reopen`');
      expect(userInstructions).not.toMatch(/secretLedger|rebalance/i);
      expect(await searchDescription(factory, USER)).not.toMatch(/secretLedger|rebalance/i);
      expect(adminInstructions).toContain('e.g. `secretLedger.update.rebalance`');
      expect(await searchDescription(factory, ADMIN)).toContain('rebalance');
    });

    it('should use the configured examples', async () => {
      const factory = makeFactory({ config: { tools: { examples: { methodId: 'guestbook.create', searchQueries: ['make guestbook'] } } } });
      const instructions = (await dispatchMcpDiscover(factory, USER)).instructions ?? '';
      const tools = await dispatchMcpToolsList<WireToolEntry>(factory, USER);
      const details = tools.find((x) => x.name === 'demo_api_details');

      expect(instructions).toContain("('make guestbook')");
      expect(instructions).toContain('e.g. `guestbook.create`');
      expect(await searchDescription(factory, USER)).toContain("e.g. 'make guestbook'");
      expect(JSON.stringify(details?.inputSchema)).toContain('e.g. `guestbook.create`');
    });

    it('should use generic wording when examples are off', async () => {
      const factory = makeFactory({ config: { tools: { examples: false } } });
      const instructions = (await dispatchMcpDiscover(factory, USER)).instructions ?? '';

      expect(instructions).toContain('a verb and/or a model name');
      expect(instructions).not.toContain('e.g.');
      expect(await searchDescription(factory, USER)).not.toContain('e.g.');
    });

    it('should name a method of the router kind when method is missing', async () => {
      const factory = makeFactory();
      const write = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_api_write', args: {} });
      const destructive = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_api_destructive', args: {} });

      expect(write.isError).toBe(true);
      expect(write.content[0].text).toContain("method: 'guestbook.create'");
      expect(destructive.content[0].text).toContain("method: 'guestbook.update.reopen'");
    });
  });

  describe('search paging', () => {
    it('should page with offset and nextOffset', async () => {
      const factory = makeFactory({ apiDetails: SEARCH_API_DETAILS });
      const first = await search(factory, USER, { query: '', model: 'guestbookEntry', limit: 1 });
      const second = await search(factory, USER, { query: '', model: 'guestbookEntry', limit: 1, offset: 1 });
      const last = await search(factory, USER, { query: '', model: 'guestbookEntry', limit: 1, offset: 2 });
      const past = await search(factory, USER, { query: '', model: 'guestbookEntry', limit: 1, offset: 5 });

      expect([first.total, second.total, last.total, past.total]).toEqual([3, 3, 3, 3]);
      expect((first as { nextOffset?: number }).nextOffset).toBe(1);
      expect((second as { nextOffset?: number }).nextOffset).toBe(2);
      expect(last).not.toHaveProperty('nextOffset');
      expect(past).not.toHaveProperty('nextOffset');
      expect(past.methods).toEqual([]);
      expect(new Set([first.methods[0].method, second.methods[0].method, last.methods[0].method]).size).toBe(3);
    });
  });

  describe('analytics', () => {
    it('should describe the executed method and the inner reason', async () => {
      const events: McpAnalyticsEvent[] = [];
      const factory = makeFactory({ events });
      await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'guestbook-create', params: { name: 'x', reason: 'inner' } });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ toolName: 'demo_api_write', toolKind: 'callModel', call: 'create', modelType: 'guestbook', method: 'guestbook.create', routed: true, args: { name: 'x' }, reason: 'inner', isSuccessful: true });
    });

    it('should name the destructive router for a destructive call', async () => {
      const events: McpAnalyticsEvent[] = [];
      const factory = makeFactory({ events });
      await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'destructive', method: 'guestbook.update.reopen', params: {} });

      expect(events[0]).toMatchObject({ toolName: 'demo_api_destructive', method: 'guestbook.update.reopen', routed: true, isSuccessful: true });
    });

    it('should prefer the outer reason and record an unresolved method', async () => {
      const events: McpAnalyticsEvent[] = [];
      const factory = makeFactory({ events });
      await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'nope.create', params: {}, extraArgs: { reason: 'outer' } });

      expect(events[0]).toMatchObject({ toolName: 'demo_api_write', toolKind: 'static', routed: true, requestedMethod: 'nope.create', reason: 'outer', isSuccessful: false });
      expect(events[0].method).toBeUndefined();
    });
  });

  describe('additional tools', () => {
    const additional: McpAdditionalTools = [
      mcpAdditionalTool({ name: 'demo_report', description: 'A demo report.', readOnly: true, expose: 'tool', handler: () => ({ total: 3 }) }),
      mcpAdditionalTool({ name: 'demo_recount', description: 'Recounts the demo totals.', readOnly: false, expose: 'method', handler: () => ({ recounted: true }) }),
      mcpAdditionalTool({ name: 'demo_tally', description: 'Adds a tally mark.', readOnly: false, destructive: false, expose: 'method', handler: () => ({ tallied: true }) })
    ];

    it('should list tool exposures and route method exposures', async () => {
      const factory = makeFactory({ additional });
      expect(await listNames(factory)).toEqual(['demo_api_search', 'demo_api_details', 'demo_api_read', 'demo_api_write', 'demo_api_destructive', 'demo_report']);

      const report = await dispatchMcpToolCall<ToolResult>({ factory, ctx: USER, name: 'demo_report' });
      expect(report.structuredContent).toEqual({ total: 3 });

      // an unclassified write runs through destructive (fail-safe); one declared destructive: false runs through write
      const recount = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'destructive', method: 'demo_recount' });
      expect(recount.structuredContent).toEqual({ recounted: true });

      const tally = await dispatchMcpMethodCall<ToolResult>({ factory, ctx: USER, kind: 'write', method: 'demo_tally' });
      expect(tally.structuredContent).toEqual({ tallied: true });
    });
  });

  describe('batch-execute', () => {
    it('should be a destructive method in compact mode and a listed tool in legacy mode', async () => {
      const storage = {};
      const compactFound = await search(makeFactory({ storage }), USER, { query: 'batch' });
      expect(compactFound.methods.find((x) => x.method === 'batch-execute')?.kind).toBe('destructive');

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
      expect(await listNames(factory)).toEqual(['demo_api_search', 'demo_api_details', 'demo_api_read', 'demo_api_write', 'demo_api_destructive', 'search_demo_documentation']);
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
