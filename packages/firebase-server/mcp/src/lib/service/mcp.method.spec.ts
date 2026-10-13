import { type ModelApiDetailsResult } from '@dereekb/firebase-server';
import { buildMcpMethodRegistry, mcpMethodIdForDispatch, mcpMethodKindForCall, mcpMethodKindForHints, mcpMethodKinds, mcpMethodSummary, normalizeMcpMethodId, type McpMethodSummary } from './mcp.method';
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
      { model: 'timesheet', call: 'update', specifier: 'reopen' },
      { model: 'worker', call: 'invoke', specifier: 'check', mcp: { destructive: false, escalatingParams: { probe: { openWorld: true } } } }
    ])
  ).tools;
  const builtin = makeBuiltin('model-get');
  const registry = buildMcpMethodRegistry([...generated.map((definition) => ({ definition, source: 'callModel' as const })), { definition: builtin, source: 'builtin' }]);

  it('should use dispatch ids for callModel methods and names for built-ins', () => {
    expect(registry.methods.map((x) => x.id)).toEqual(['worker.create', 'worker.read', 'worker.invoke.check', 'timesheet.update.reopen', 'model-get']);
  });

  it('should classify kinds from the effective read-only and destructive flags', () => {
    expect(registry.methods.map((x) => x.kind)).toEqual(['write', 'read', 'write', 'destructive', 'read']);
  });

  it('should carry escalating params with their raised kind', () => {
    const method = registry.methods[2];
    const expected = [{ param: 'probe', kind: 'destructive', hints: { openWorld: true } }];
    expect(method.escalatingParams).toEqual(expected);
    expect(mcpMethodSummary(method).escalatingParams).toEqual(expected);
    expect(registry.methods[0].escalatingParams).toBeUndefined();
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
      expect(view.resolve('batch-execute')?.kind).toBe('destructive');
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

describe('mcpMethodKindForHints()', () => {
  it('should map hints to a kind', () => {
    expect(mcpMethodKindForHints({ readOnly: true })).toBe('read');
    expect(mcpMethodKindForHints({ readOnly: false, destructive: false })).toBe('write');
    expect(mcpMethodKindForHints({ readOnly: false, destructive: true })).toBe('destructive');
  });

  it('should treat an unclassified write as destructive', () => {
    expect(mcpMethodKindForHints({})).toBe('destructive');
    expect(mcpMethodKindForHints({ readOnly: false })).toBe('destructive');
  });

  it('should treat an open-world write as destructive', () => {
    expect(mcpMethodKindForHints({ readOnly: false, destructive: false, openWorld: true })).toBe('destructive');
  });
});

describe('mcpMethodKindForCall()', () => {
  const escalating: McpMethodSummary = { id: 'worker.invoke.check', aliases: [], kind: 'write', source: 'callModel', escalatingParams: [{ param: 'probe', kind: 'destructive', hints: { openWorld: true } }] };

  it('should keep the base kind when no escalating param is set', () => {
    for (const params of [{}, undefined, { probe: false }, { probe: null }]) {
      expect(mcpMethodKindForCall(escalating, params)).toEqual({ kind: 'write', escalatedBy: [] });
    }
  });

  it('should raise the kind when an escalating param is set', () => {
    for (const params of [{ probe: true }, { probe: 'yes' }, { probe: 0 }, { probe: '' }]) {
      expect(mcpMethodKindForCall(escalating, params)).toEqual({ kind: 'destructive', escalatedBy: ['probe'] });
    }
  });

  it('should ignore an inherited param', () => {
    expect(mcpMethodKindForCall(escalating, Object.create({ probe: true }) as Record<string, unknown>)).toEqual({ kind: 'write', escalatedBy: [] });
  });

  it('should not list a param that does not raise the base kind', () => {
    const destructive: McpMethodSummary = { ...escalating, kind: 'destructive' };
    expect(mcpMethodKindForCall(destructive, { probe: true })).toEqual({ kind: 'destructive', escalatedBy: [] });
  });
});

describe('mcpMethodKinds()', () => {
  it('should list the base kind plus every escalation kind', () => {
    const escalating: McpMethodSummary = { id: 'a', aliases: [], kind: 'write', source: 'callModel', escalatingParams: [{ param: 'probe', kind: 'destructive', hints: { openWorld: true } }] };
    expect(mcpMethodKinds(escalating)).toEqual(['write', 'destructive']);
    expect(mcpMethodKinds({ id: 'b', aliases: [], kind: 'read', source: 'builtin' })).toEqual(['read']);
  });
});
