import { type ModelApiDetailsResult } from '@dereekb/firebase-server';
import { buildMcpMethodRegistry, mcpMethodIdForDispatch, normalizeMcpMethodId } from './mcp.method';
import { buildStaticToolDefinition, generateMcpToolDefinitions, type McpToolDefinition } from './mcp.tool-generator';

function makeApiDetails(spec: ReadonlyArray<{ model: string; call: string; specifier?: string; mcp?: object }>): ModelApiDetailsResult {
  const models: Record<string, { calls: Record<string, { isSpecifier: boolean; specifiers: Record<string, object> }> }> = {};

  for (const entry of spec) {
    const modelEntry = (models[entry.model] ??= { calls: {} });
    const callEntry = (modelEntry.calls[entry.call] ??= { isSpecifier: entry.specifier != null, specifiers: {} });
    callEntry.specifiers[entry.specifier ?? '_'] = { inputType: { toJsonSchema: () => ({ type: 'object' }) }, mcp: entry.mcp };
  }

  return { models } as unknown as ModelApiDetailsResult;
}

function makeBuiltin(name: string, readOnly = true): McpToolDefinition {
  return buildStaticToolDefinition({ name, description: name, inputSchema: { type: 'object' }, dispatch: { call: name, modelType: 'builtin' }, effectiveReadOnly: readOnly, staticHandler: async () => ({ content: [] }) });
}

describe('mcpMethodIdForDispatch()', () => {
  it('should omit the default specifier', () => {
    expect(mcpMethodIdForDispatch({ modelType: 'worker', call: 'create' })).toBe('worker.create');
    expect(mcpMethodIdForDispatch({ modelType: 'worker', call: 'create', specifier: '_' })).toBe('worker.create');
  });

  it('should append a named specifier', () => {
    expect(mcpMethodIdForDispatch({ modelType: 'jobWorkerTimesheet', call: 'update', specifier: 'reopen' })).toBe('jobWorkerTimesheet.update.reopen');
  });
});

describe('normalizeMcpMethodId()', () => {
  it('should trim and lowercase', () => {
    expect(normalizeMcpMethodId(' Worker.Create ')).toBe('worker.create');
  });
});

describe('buildMcpMethodRegistry()', () => {
  const generated = generateMcpToolDefinitions(
    makeApiDetails([
      { model: 'worker', call: 'create' },
      { model: 'worker', call: 'read' },
      { model: 'timesheet', call: 'update', specifier: 'reopen' }
    ])
  ).tools;
  const builtin = makeBuiltin('model-get');
  const registry = buildMcpMethodRegistry([...generated.map((definition) => ({ definition, source: 'callModel' as const })), { definition: builtin, source: 'builtin' }]);

  it('should use dispatch ids for callModel methods and names for built-ins', () => {
    expect(registry.methods.map((x) => x.id)).toEqual(['worker.create', 'worker.read', 'timesheet.update.reopen', 'model-get']);
  });

  it('should classify kinds from the effective read-only flag', () => {
    expect(registry.methods.map((x) => x.kind)).toEqual(['write', 'read', 'write', 'read']);
  });

  it('should add the legacy tool name and manifest key as aliases', () => {
    const method = registry.methods[0];
    expect(method.aliases).toEqual(['worker-create', 'worker.create._']);
  });

  describe('view()', () => {
    it('should resolve by id or alias, case-insensitively', () => {
      const view = registry.view([...generated, builtin]);
      expect(view.resolve('WORKER.create')?.id).toBe('worker.create');
      expect(view.resolve('timesheet-reopen')?.id).toBe('timesheet.update.reopen');
      expect(view.resolve('worker.create._')?.id).toBe('worker.create');
    });

    it('should not resolve methods outside the view', () => {
      const view = registry.view([generated[1]]);
      expect(view.resolve('worker.create')).toBeUndefined();
      expect(view.resolve('worker-create')).toBeUndefined();
      expect(view.methods.map((x) => x.id)).toEqual(['worker.read']);
    });

    it('should add unknown definitions as built-in methods', () => {
      const batch = makeBuiltin('batch-execute', false);
      const view = registry.view([batch]);
      expect(view.resolve('batch-execute')?.kind).toBe('write');
    });
  });

  describe('alias collisions', () => {
    it('should drop an alias that collides with another method id', () => {
      const [overridden] = generateMcpToolDefinitions(makeApiDetails([{ model: 'worker', call: 'invoke', specifier: 'sync', mcp: { name: 'model-get' } }])).tools;
      const collided = buildMcpMethodRegistry([
        { definition: overridden, source: 'callModel' },
        { definition: builtin, source: 'builtin' }
      ]);

      expect(collided.methods[0].aliases).not.toContain('model-get');
      expect(collided.warnings.length).toBeGreaterThan(0);
      expect(collided.view([overridden, builtin]).resolve('model-get')?.id).toBe('model-get');
    });
  });
});
