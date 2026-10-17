import { buildMcpCompactInstructions, MCP_CLIENT_TEXT_MAX_LENGTH, MCP_TOOL_NAME_PREFIX_MAX_LENGTH, mcpAdditionalTool, planMcpToolSurface, resolveMcpCompactToolNames, resolveMcpToolNamePrefix } from './mcp.compact';
import { buildStaticToolDefinition, type McpToolDefinition } from './mcp.tool-generator';

function makeTool(name: string, readOnly = true, target?: { call: string; modelType: string; specifier?: string; destructive?: boolean }): McpToolDefinition {
  const { destructive, ...dispatch } = target ?? { call: name, modelType: 'builtin' };
  return buildStaticToolDefinition({ name, description: name, inputSchema: { type: 'object' }, dispatch, effectiveReadOnly: readOnly, destructive, staticHandler: async () => ({ content: [] }) });
}

describe('resolveMcpToolNamePrefix()', () => {
  it('should strip trailing mcp and api segments', () => {
    expect(resolveMcpToolNamePrefix('demo-api-mcp')).toBe('demo');
    expect(resolveMcpToolNamePrefix('joinfoodflip-api-mcp')).toBe('joinfoodflip');
    expect(resolveMcpToolNamePrefix('dbx-firebase-server-mcp')).toBe('dbx_firebase_server');
  });

  it('should throw when nothing is left', () => {
    expect(() => resolveMcpToolNamePrefix('--')).toThrow();
  });
});

describe('resolveMcpCompactToolNames()', () => {
  it('should resolve the default names', () => {
    expect(resolveMcpCompactToolNames({ prefix: 'demo' })).toEqual({ search: 'demo_api_search', details: 'demo_api_details', read: 'demo_api_read', write: 'demo_api_write', destructive: 'demo_api_destructive', token: 'demo_cli_token', documentation: 'search_demo_documentation', info: 'demo_api_info' });
  });

  it('should apply an info override and reject an info name used by another compact tool', () => {
    expect(resolveMcpCompactToolNames({ prefix: 'demo', names: { info: 'demo_catalog' } }).info).toBe('demo_catalog');
    expect(() => resolveMcpCompactToolNames({ prefix: 'demo', names: { info: 'demo_api_search' } })).toThrow();
  });

  it('should apply overrides', () => {
    expect(resolveMcpCompactToolNames({ prefix: 'demo', names: { search: 'find' } }).search).toBe('find');
  });

  it('should accept a prefix at the max length', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'a'.repeat(MCP_TOOL_NAME_PREFIX_MAX_LENGTH) });
    expect(names.documentation.length).toBeLessThanOrEqual(64);
  });

  it('should throw for a prefix over the max length', () => {
    expect(() => resolveMcpCompactToolNames({ prefix: 'a'.repeat(MCP_TOOL_NAME_PREFIX_MAX_LENGTH + 1) })).toThrow();
  });

  it('should throw for an invalid override', () => {
    expect(() => resolveMcpCompactToolNames({ prefix: 'demo', names: { read: 'has.dot' } })).toThrow();
  });

  it('should throw for a duplicate override', () => {
    expect(() => resolveMcpCompactToolNames({ prefix: 'demo', names: { read: 'demo_api_write' } })).toThrow();
    expect(() => resolveMcpCompactToolNames({ prefix: 'demo', names: { destructive: 'demo_api_write' } })).toThrow();
  });
});

describe('buildMcpCompactInstructions()', () => {
  it('should stay under the client text limit with every option on', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'a'.repeat(MCP_TOOL_NAME_PREFIX_MAX_LENGTH) });
    const examples = { methodId: 'm'.repeat(64), methodIdByKind: {}, searchQueries: ['q'.repeat(40), 'r'.repeat(40)] };
    const text = buildMcpCompactInstructions({
      app: 'a'.repeat(MCP_TOOL_NAME_PREFIX_MAX_LENGTH),
      names,
      builtinReadMethods: ['model-get', 'model-roles', 'url-models', 'model-info', 'model-decode', 'enum-info', 'whoami', 'docs-read'],
      hasDocumentation: true,
      hasToken: true,
      hasInfo: true,
      methodToolsListed: true,
      examples
    });
    expect(text.length).toBeLessThan(MCP_CLIENT_TEXT_MAX_LENGTH);
    expect(text).toContain(names.search);
    expect(text).toContain(names.destructive);
    expect(text).toContain(names.documentation);
    expect(text).toContain(names.info);
    expect(text).toContain('Per-method tools are also listed.');
  });

  it('should include the example method id and queries', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'demo' });
    const text = buildMcpCompactInstructions({ app: 'demo', names, builtinReadMethods: [], hasDocumentation: false, hasToken: false, methodToolsListed: false, examples: { methodId: 'calendar.update.rotateIcs', methodIdByKind: {}, searchQueries: ['rotate calendar', 'create form space'] } });
    expect(text).toContain('e.g. `calendar.update.rotateIcs`');
    expect(text).toContain("('rotate calendar', 'create form space')");
  });

  it('should use generic wording without examples', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'demo' });
    const text = buildMcpCompactInstructions({ app: 'demo', names, builtinReadMethods: [], hasDocumentation: false, hasToken: false, methodToolsListed: false });
    expect(text).toContain('a verb and/or a model name');
    expect(text).toContain('`model.call` or `model.call.specifier`');
    expect(text).not.toContain('e.g.');
  });

  it('should name the info tool only when it is listed, without examples', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'demo' });
    const base = { app: 'demo', names, builtinReadMethods: [], hasDocumentation: false, hasToken: false, methodToolsListed: false };
    const withInfo = buildMcpCompactInstructions({ ...base, hasInfo: true });

    expect(withInfo).toContain('`demo_api_info` describes the data model');
    expect(withInfo).not.toContain('e.g.');
    expect(buildMcpCompactInstructions(base)).not.toContain(names.info);
  });

  it('should only name the read router in readOnly mode', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'demo' });
    const text = buildMcpCompactInstructions({ app: 'demo', names, builtinReadMethods: [], hasDocumentation: false, hasToken: false, methodToolsListed: false, readOnly: true });
    expect(text).toContain(names.read);
    expect(text).not.toContain(names.write);
    expect(text).not.toContain(names.destructive);
  });
});

describe('planMcpToolSurface()', () => {
  const compactNames = resolveMcpCompactToolNames({ prefix: 'demo' });
  const generatedRead = makeTool('guestbook-read', true, { call: 'read', modelType: 'guestbook' });
  const generatedCreate = makeTool('guestbook-create', false, { call: 'create', modelType: 'guestbook', destructive: false });
  const unclassifiedWrite = makeTool('guestbook-sync', false, { call: 'invoke', modelType: 'guestbook', specifier: 'sync' });
  const builtin = makeTool('model-get');

  it('should promote nothing by default', () => {
    const plan = planMcpToolSurface({ compact: true, methodTools: undefined, compactNames, generated: [generatedRead, generatedCreate], builtins: [builtin] });
    expect(plan.promoted.size).toBe(0);
    expect(plan.methodCandidates).toEqual([generatedRead, generatedCreate, builtin]);
    expect(plan.alwaysLoad.size).toBe(0);
  });

  it('should list the info tool in compact mode only, never in alwaysLoad', () => {
    const info = makeTool('demo_api_info', true, { call: 'info', modelType: 'catalog' });
    const compactPlan = planMcpToolSurface({ compact: true, methodTools: undefined, compactNames, generated: [], builtins: [], info });
    const legacyPlan = planMcpToolSurface({ compact: false, methodTools: true, compactNames, generated: [], builtins: [], info });

    expect(compactPlan.standaloneTools).toEqual([info]);
    expect(compactPlan.alwaysLoad.has(info)).toBe(false);
    expect(legacyPlan.standaloneTools).toEqual([]);
  });

  it('should drop an additional tool named like the info tool', () => {
    const additional = mcpAdditionalTool({ name: 'demo_api_info', description: 'x', readOnly: true, expose: 'tool', handler: () => ({ ok: true }) });
    const plan = planMcpToolSurface({ compact: true, methodTools: undefined, compactNames, generated: [], builtins: [], additional: [additional] });

    expect(plan.standaloneTools).toEqual([]);
    expect(plan.errors.length).toBe(1);
  });

  it('should promote every method without alwaysLoad when methodTools is true', () => {
    const plan = planMcpToolSurface({ compact: true, methodTools: true, compactNames, generated: [generatedRead, generatedCreate], builtins: [builtin], batchName: 'batch-execute' });
    expect(plan.promoted.size).toBe(3);
    expect(plan.alwaysLoad.size).toBe(0);
    expect(plan.batchPromoted).toBe(true);
  });

  it('should promote listed methods by id or alias with alwaysLoad', () => {
    const plan = planMcpToolSurface({ compact: true, methodTools: ['model-get', 'guestbook-read', 'missing'], compactNames, generated: [generatedRead, generatedCreate], builtins: [builtin] });
    expect([...plan.promoted]).toEqual([generatedRead, builtin]);
    expect(plan.alwaysLoad.has(builtin)).toBe(true);
    expect(plan.warnings.some((x) => x.includes('missing'))).toBe(true);
  });

  it('should promote by predicate', () => {
    const plan = planMcpToolSurface({ compact: true, methodTools: (method) => method.kind === 'write', compactNames, generated: [generatedRead, generatedCreate], builtins: [builtin] });
    expect([...plan.promoted]).toEqual([generatedCreate]);
  });

  it('should select an unclassified write with a destructive predicate', () => {
    const plan = planMcpToolSurface({ compact: true, methodTools: (method) => method.kind === 'destructive', compactNames, generated: [generatedRead, generatedCreate, unclassifiedWrite], builtins: [builtin] });
    expect([...plan.promoted]).toEqual([unclassifiedWrite]);
  });

  it('should treat the batch tool as destructive for a predicate', () => {
    const destructivePlan = planMcpToolSurface({ compact: true, methodTools: (method) => method.kind === 'destructive', compactNames, generated: [], builtins: [], batchName: 'batch-execute' });
    const writePlan = planMcpToolSurface({ compact: true, methodTools: (method) => method.kind === 'write', compactNames, generated: [], builtins: [], batchName: 'batch-execute' });
    expect(destructivePlan.batchPromoted).toBe(true);
    expect(writePlan.batchPromoted).toBe(false);
  });

  it('should not promote a built-in whose name collides with a generated tool in legacy mode', () => {
    const collidingGenerated = makeTool('model-get', true, { call: 'read', modelType: 'model' });
    const plan = planMcpToolSurface({ compact: false, methodTools: true, compactNames, generated: [collidingGenerated], builtins: [builtin] });
    expect([...plan.promoted]).toEqual([collidingGenerated]);
    expect(plan.warnings.some((x) => x.includes('collides with an auto-generated tool'))).toBe(true);
  });

  describe('additional tools', () => {
    const handler = () => ({ ok: true });

    it('should place tools by their expose value', () => {
      const tool = mcpAdditionalTool({ name: 'demo_report', description: 'Report.', readOnly: true, expose: 'tool', handler });
      const method = mcpAdditionalTool({ name: 'demo_method', description: 'Method.', readOnly: true, expose: 'method', handler });
      const both = mcpAdditionalTool({ name: 'demo_both', description: 'Both.', readOnly: false, expose: 'both', handler });
      const plan = planMcpToolSurface({ compact: true, methodTools: undefined, compactNames, generated: [], builtins: [], additional: [tool, method, both] });

      expect(plan.standaloneTools).toEqual([tool.definition]);
      expect(plan.methodCandidates).toEqual([method.definition, both.definition]);
      expect([...plan.promoted]).toEqual([both.definition]);
      expect(plan.alwaysLoad.has(tool.definition)).toBe(true);
      expect(plan.alwaysLoad.has(both.definition)).toBe(true);
      expect(plan.registry.methods.find((x) => x.id === 'demo_both')?.source).toBe('additional');
    });

    it('should drop names with dots and names that collide', () => {
      const dotted = mcpAdditionalTool({ name: 'demo.report', description: 'x', readOnly: true, expose: 'tool', handler });
      const collidesWithMethod = mcpAdditionalTool({ name: 'guestbook.read', description: 'x', readOnly: true, expose: 'tool', handler });
      const collidesWithAlias = mcpAdditionalTool({ name: 'guestbook-read', description: 'x', readOnly: true, expose: 'tool', handler });
      const collidesWithCompact = mcpAdditionalTool({ name: 'demo_api_read', description: 'x', readOnly: true, expose: 'tool', handler });
      const collidesWithDestructive = mcpAdditionalTool({ name: 'demo_api_destructive', description: 'x', readOnly: false, expose: 'tool', handler });
      const plan = planMcpToolSurface({ compact: true, methodTools: undefined, compactNames, generated: [generatedRead], builtins: [], additional: [dotted, collidesWithMethod, collidesWithAlias, collidesWithCompact, collidesWithDestructive] });

      expect(plan.standaloneTools).toEqual([]);
      expect(plan.errors.length).toBe(5);
    });

    it('should classify a write tool as destructive unless it declares destructive: false', () => {
      const unclassified = mcpAdditionalTool({ name: 'demo_recount', description: 'Recount.', readOnly: false, expose: 'tool', handler });
      const additive = mcpAdditionalTool({ name: 'demo_tally', description: 'Tally.', readOnly: false, destructive: false, expose: 'tool', handler });

      expect(unclassified.definition.annotations).toEqual({ readOnlyHint: false, destructiveHint: true });
      expect(unclassified.definition.description).toBe('[WRITE] Recount.');
      expect(additive.definition.annotations).toEqual({ readOnlyHint: false, destructiveHint: false });
    });

    it('should format handler results like a callModel result', async () => {
      const tool = mcpAdditionalTool({ name: 'demo_report', description: 'Report.', readOnly: true, expose: 'tool', handler: () => ({ total: 3 }) });
      const result = await tool.definition.staticHandler?.({}, { rawRequest: {} as never });
      expect(result?.structuredContent).toEqual({ total: 3 });
      expect(tool.definition.annotations?.readOnlyHint).toBe(true);
    });
  });
});
