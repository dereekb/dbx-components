import { buildModelManifestCatalog } from '@dereekb/firebase/manifest';
import { describe, expect, it } from 'vitest';
import { buildMcpCompactDetailsInputSchema, buildMcpCompactInstructions, buildMcpCompactSearchInputSchema, MCP_COMPACT_ROUTER_INPUT_SCHEMA, resolveMcpCompactToolNames } from './mcp.compact';
import { EMPTY_MCP_TOOL_CATALOG_EXAMPLES, EMPTY_MCP_TOOL_METHOD_EXAMPLES, findMcpToolExamplesConfigWarnings, mcpMethodExampleSearchQuery, mcpToolExamplePageUrl, resolveMcpToolCatalogExamples, resolveMcpToolMethodExamples } from './mcp.examples';
import { type McpManifestEnum, type McpManifestModelEntry } from './mcp.manifest';
import { buildMcpMethodRegistry, type McpMethodSummary } from './mcp.method';
import { buildMcpMethodSearchEntries } from './mcp.method.search';
import { ROUTE_MANIFEST_VERSION, type RouteManifest } from './mcp.route-manifest';
import { createMcpCompactDetailsTool } from './tools/mcp.tool.compact-details';
import { createMcpCompactInfoTool } from './tools/mcp.tool.compact-info';
import { createMcpCompactRouterTool } from './tools/mcp.tool.compact-router';
import { createMcpCompactSearchTool } from './tools/mcp.tool.compact-search';
import { createEnumInfoTool } from './tools/mcp.tool.enum-info';
import { createModelDecodeTool } from './tools/mcp.tool.model-decode';
import { createModelGetTool } from './tools/mcp.tool.model-get';
import { createModelRolesTool } from './tools/mcp.tool.model-roles';
import { createUrlModelsTool } from './tools/mcp.tool.url-models';

function method(input: Partial<McpMethodSummary> & Pick<McpMethodSummary, 'id'>): McpMethodSummary {
  return { aliases: [], kind: 'write', source: 'callModel', ...input };
}

function model(input: Partial<McpManifestModelEntry> & Pick<McpManifestModelEntry, 'modelType' | 'collectionPrefix'>): McpManifestModelEntry {
  return { modelName: input.modelType, identityConst: `${input.modelType}Identity`, sourcePackage: 'x', sourceFile: 'x.ts', fields: [], ...input };
}

const ENUM: McpManifestEnum = { name: 'SampleEnum', values: [] } as unknown as McpManifestEnum;

const METHODS: McpMethodSummary[] = [
  method({ id: 'model-get', kind: 'read', source: 'builtin' }),
  method({ id: 'formSpace.create', modelType: 'formSpace', call: 'create' }),
  method({ id: 'calendar.update.rotateIcs', modelType: 'calendar', call: 'update', specifier: 'rotateIcs' }),
  method({ id: 'calendar.create', modelType: 'calendar', call: 'create' }),
  method({ id: 'calendar.delete', modelType: 'calendar', call: 'delete', kind: 'destructive' }),
  method({ id: 'calendar.read', modelType: 'calendar', call: 'read', kind: 'read' })
];

describe('mcpMethodExampleSearchQuery()', () => {
  it('should use the specifier verb and the last two model words', () => {
    expect(mcpMethodExampleSearchQuery(method({ id: 'x', modelType: 'jobWorkerTimesheet', call: 'update', specifier: 'reopen' }))).toBe('reopen worker timesheet');
  });

  it('should use the call when there is no specifier', () => {
    expect(mcpMethodExampleSearchQuery(method({ id: 'x', modelType: 'formSpace', call: 'create' }))).toBe('create form space');
  });

  it('should ignore the default specifier', () => {
    expect(mcpMethodExampleSearchQuery(method({ id: 'x', modelType: 'calendar', call: 'create', specifier: '_' }))).toBe('create calendar');
  });

  it('should skip stop words in the specifier', () => {
    expect(mcpMethodExampleSearchQuery(method({ id: 'x', modelType: 'guestbook', call: 'update', specifier: 'forSubscribe' }))).toBe('subscribe guestbook');
  });

  it('should drop a noun equal to the verb', () => {
    expect(mcpMethodExampleSearchQuery(method({ id: 'x', modelType: 'syncJob', call: 'update', specifier: 'sync' }))).toBe('sync job');
  });

  it('should return undefined without a model type', () => {
    expect(mcpMethodExampleSearchQuery(method({ id: 'model-get', source: 'builtin' }))).toBeUndefined();
  });
});

describe('resolveMcpToolMethodExamples()', () => {
  it('should prefer an update method with a specifier', () => {
    const examples = resolveMcpToolMethodExamples({ methods: METHODS });
    expect(examples.methodId).toBe('calendar.update.rotateIcs');
    expect(examples.modelType).toBe('calendar');
    expect(examples.searchQueries).toEqual(['rotate calendar', 'create form space']);
  });

  it('should fall back to any method with a specifier, then the first method', () => {
    expect(resolveMcpToolMethodExamples({ methods: [METHODS[1], method({ id: 'a.read.byX', modelType: 'a', call: 'read', specifier: 'byX', kind: 'read' })] }).methodId).toBe('a.read.byX');
    expect(resolveMcpToolMethodExamples({ methods: [METHODS[1]] }).methodId).toBe('formSpace.create');
  });

  it('should never use a builtin method', () => {
    const examples = resolveMcpToolMethodExamples({ methods: [METHODS[0]] });
    expect(examples.methodId).toBeUndefined();
    expect(examples.searchQueries).toEqual([]);
  });

  it('should pick a method per kind', () => {
    const examples = resolveMcpToolMethodExamples({ methods: METHODS });
    expect(examples.methodIdByKind).toEqual({ read: 'calendar.read', write: 'formSpace.create', destructive: 'calendar.delete' });
  });

  it('should prefer configured values field by field', () => {
    const examples = resolveMcpToolMethodExamples({ config: { methodId: 'x.y', searchQueries: [' a b ', '', 'c', 'd'] }, methods: METHODS });
    expect(examples.methodId).toBe('x.y');
    expect(examples.methodIdByKind.read).toBe('x.y');
    expect(examples.searchQueries).toEqual(['a b', 'c']);
    expect(examples.modelType).toBe('calendar');
  });

  it('should return empty examples for false', () => {
    expect(resolveMcpToolMethodExamples({ config: false, methods: METHODS })).toBe(EMPTY_MCP_TOOL_METHOD_EXAMPLES);
  });
});

describe('resolveMcpToolCatalogExamples()', () => {
  const MODELS = [
    model({ modelType: 'child', collectionPrefix: 'ch', parentIdentityConst: 'calendarIdentity' }),
    model({ modelType: 'single', collectionPrefix: 'sg', singleton: true }),
    model({ modelType: 'composite', collectionPrefix: 'cp', compositeKey: { from: '*', encoding: 'two-way' } }),
    model({ modelType: 'secret', collectionPrefix: 'sc', serverOnly: true }),
    model({ modelType: 'calendar', collectionPrefix: 'cal' }),
    model({ modelType: 'formSpace', collectionPrefix: 'fs' }),
    model({ modelType: 'other', collectionPrefix: 'ot' })
  ];

  it('should derive from root, non-singleton, non-composite, non-server-only models', () => {
    const examples = resolveMcpToolCatalogExamples({ models: MODELS, enums: { SampleEnum: ENUM } });
    expect(examples.modelTypes).toEqual(['calendar', 'formSpace']);
    expect(examples.modelKey).toBe('cal/abc123');
    expect(examples.enumName).toBe('SampleEnum');
    expect(examples.pageUrl).toBeUndefined();
  });

  it('should prefer configured values', () => {
    const examples = resolveMcpToolCatalogExamples({ config: { modelType: 'formSpace', modelKey: 'fs/1', enumName: 'E', pageUrl: 'https://x.com/a' }, models: MODELS });
    expect(examples).toEqual({ modelTypes: ['formSpace'], modelKey: 'fs/1', enumName: 'E', pageUrl: 'https://x.com/a' });
  });

  it('should return empty examples for false', () => {
    expect(resolveMcpToolCatalogExamples({ config: false, models: MODELS })).toBe(EMPTY_MCP_TOOL_CATALOG_EXAMPLES);
  });
});

describe('mcpToolExamplePageUrl()', () => {
  function routeManifest(states: RouteManifest['states'], baseUrl?: string): RouteManifest {
    return { version: ROUTE_MANIFEST_VERSION, generatedAt: '', app: { name: 'app', ...(baseUrl ? { baseUrl } : undefined) }, states };
  }

  const MODEL = { modelType: 'calendar', kind: 'id' as const };

  it('should prefer a parameterized url and substitute its params', () => {
    const url = mcpToolExamplePageUrl(
      routeManifest(
        [
          { name: 'a', fullUrl: '/a', paramKeys: [], urlParamKeys: [], models: [MODEL] },
          { name: 'b', fullUrl: '/cal/:id/{tab}', paramKeys: ['id'], urlParamKeys: ['id'], models: [MODEL] }
        ],
        'https://demo.example.com/'
      )
    );
    expect(url).toBe('https://demo.example.com/cal/abc123/abc123');
  });

  it('should skip abstract states and states without models, and default the base url', () => {
    const url = mcpToolExamplePageUrl(
      routeManifest([
        { name: 'a', fullUrl: '/a/:id', abstract: true, paramKeys: [], urlParamKeys: [], models: [MODEL] },
        { name: 'b', fullUrl: '/b/:id', paramKeys: [], urlParamKeys: [], models: [] },
        { name: 'c', fullUrl: '/c', paramKeys: [], urlParamKeys: [], models: [MODEL] }
      ])
    );
    expect(url).toBe('https://app.example.com/c');
  });

  it('should return undefined without a route manifest', () => {
    expect(mcpToolExamplePageUrl(undefined)).toBeUndefined();
  });
});

describe('findMcpToolExamplesConfigWarnings()', () => {
  const registry = { resolveForSelector: (name: string) => (name === 'known.create' ? ({} as never) : undefined) };

  it('should warn for an unknown method id, model type, and enum name', () => {
    const warnings = findMcpToolExamplesConfigWarnings({ config: { methodId: 'nope', modelType: 'nope', enumName: 'Nope' }, registry, models: [model({ modelType: 'calendar', collectionPrefix: 'cal' })], enums: { SampleEnum: ENUM } });
    expect(warnings).toHaveLength(3);
  });

  it('should not warn for known values or unloaded catalogs', () => {
    expect(findMcpToolExamplesConfigWarnings({ config: { methodId: 'known.create', modelType: 'calendar', enumName: 'SampleEnum' }, registry, models: [model({ modelType: 'calendar', collectionPrefix: 'cal' })], enums: { SampleEnum: ENUM } })).toEqual([]);
    expect(findMcpToolExamplesConfigWarnings({ config: { modelType: 'x', enumName: 'Y' }, registry })).toEqual([]);
  });
});

describe('app-neutral defaults', () => {
  const APP_SPECIFIC_NAMES = /\b(worker|timesheet|district|jobdistrict|guestbook|profile)\b/i;

  it('should not name app-specific models in the default tool text', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'x' });
    const registry = buildMcpMethodRegistry([]);
    const view = registry.view([]);
    const entries = buildMcpMethodSearchEntries([]);
    const routeManifest: RouteManifest = { version: ROUTE_MANIFEST_VERSION, generatedAt: '', app: { name: 'x' }, states: [{ name: 'a', fullUrl: '/a', paramKeys: [], urlParamKeys: [], models: [] }] };
    const readDocuments = async () => ({ results: [], errors: [] });

    const tools = [
      createModelGetTool({ readDocuments, resolveIdentity: () => undefined }),
      createModelGetTool({ readDocuments, resolveIdentity: () => undefined, resolveIdentityForKey: () => undefined }),
      createModelRolesTool({ readRoleMaps: async () => ({ targeted: false, results: [], errors: [] }) as never, resolveIdentity: () => undefined }),
      createEnumInfoTool({ enums: { SampleEnum: ENUM } }),
      createModelDecodeTool({ manifest: [model({ modelType: 'calendar', collectionPrefix: 'cal' })] }),
      createUrlModelsTool({ routeManifest, readDocuments, resolveIdentity: () => undefined }),
      createMcpCompactSearchTool({ name: names.search, app: 'x', names, entries, view }),
      createMcpCompactDetailsTool({ name: names.details, app: 'x', names, entries, view, isListedAsTool: () => false, resolveWireEntry: () => ({}) as never }),
      createMcpCompactRouterTool({ name: names.read, kind: 'read', app: 'x', names }),
      createMcpCompactRouterTool({ name: names.write, kind: 'write', app: 'x', names }),
      createMcpCompactRouterTool({ name: names.destructive, kind: 'destructive', app: 'x', names }),
      createMcpCompactInfoTool({ name: names.info, app: 'x', catalog: buildModelManifestCatalog({ models: [model({ modelType: 'calendar', collectionPrefix: 'cal' })], enums: { SampleEnum: ENUM } }) })
    ];

    const text = JSON.stringify([
      tools.map((tool) => [tool.description, tool.inputSchema, tool.outputSchema]),
      buildMcpCompactSearchInputSchema(),
      buildMcpCompactDetailsInputSchema(),
      MCP_COMPACT_ROUTER_INPUT_SCHEMA,
      buildMcpCompactInstructions({ app: 'x', names, builtinReadMethods: ['model-get'], hasDocumentation: true, hasToken: true, hasInfo: true, methodToolsListed: true })
    ]);

    expect(text).not.toMatch(APP_SPECIFIC_NAMES);
  });
});
