import { buildMcpCompactInstructions, MCP_CLIENT_TEXT_MAX_LENGTH, MCP_TOOL_NAME_PREFIX_MAX_LENGTH, mcpAdditionalTool, planMcpToolSurface, resolveMcpCompactToolNames, resolveMcpToolNamePrefix } from './mcp.compact';
import { buildStaticToolDefinition, type McpToolDefinition } from './mcp.tool-generator';

function makeTool(name: string, readOnly = true, dispatch?: { call: string; modelType: string; specifier?: string }): McpToolDefinition {
  return buildStaticToolDefinition({ name, description: name, inputSchema: { type: 'object' }, dispatch: dispatch ?? { call: name, modelType: 'builtin' }, effectiveReadOnly: readOnly, staticHandler: async () => ({ content: [] }) });
}

describe('resolveMcpToolNamePrefix()', () => {
  it('should strip trailing mcp and api segments', () => {
    expect(resolveMcpToolNamePrefix('hellosubs-api-mcp')).toBe('hellosubs');
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
    expect(resolveMcpCompactToolNames({ prefix: 'demo' })).toEqual({ search: 'demo_mcp_search', details: 'demo_mcp_details', read: 'demo_mcp_read', write: 'demo_mcp_write', token: 'demo_mcp_token', documentation: 'search_demo_documentation' });
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
    expect(() => resolveMcpCompactToolNames({ prefix: 'demo', names: { read: 'demo_mcp_write' } })).toThrow();
  });
});

describe('buildMcpCompactInstructions()', () => {
  it('should stay under the client text limit with every option on', () => {
    const names = resolveMcpCompactToolNames({ prefix: 'a'.repeat(MCP_TOOL_NAME_PREFIX_MAX_LENGTH) });
    const text = buildMcpCompactInstructions({ app: 'a'.repeat(MCP_TOOL_NAME_PREFIX_MAX_LENGTH), names, builtinReadMethods: ['model-get', 'model-roles', 'url-models', 'model-info', 'model-decode', 'enum-info', 'whoami', 'docs-read'], hasDocumentation: true, hasToken: true, methodToolsListed: true });
    expect(text.length).toBeLessThan(MCP_CLIENT_TEXT_MAX_LENGTH);
    expect(text).toContain(names.search);
    expect(text).toContain(names.documentation);
    expect(text).toContain('Per-method tools are also listed.');
  });
});

describe('planMcpToolSurface()', () => {
  const compactNames = resolveMcpCompactToolNames({ prefix: 'demo' });
  const generatedRead = makeTool('guestbook-read', true, { call: 'read', modelType: 'guestbook' });
  const generatedCreate = makeTool('guestbook-create', false, { call: 'create', modelType: 'guestbook' });
  const builtin = makeTool('model-get');

  it('should promote nothing by default', () => {
    const plan = planMcpToolSurface({ compact: true, methodTools: undefined, compactNames, generated: [generatedRead, generatedCreate], builtins: [builtin] });
    expect(plan.promoted.size).toBe(0);
    expect(plan.methodCandidates).toEqual([generatedRead, generatedCreate, builtin]);
    expect(plan.alwaysLoad.size).toBe(0);
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
      const collidesWithCompact = mcpAdditionalTool({ name: 'demo_mcp_read', description: 'x', readOnly: true, expose: 'tool', handler });
      const plan = planMcpToolSurface({ compact: true, methodTools: undefined, compactNames, generated: [generatedRead], builtins: [], additional: [dotted, collidesWithMethod, collidesWithAlias, collidesWithCompact] });

      expect(plan.standaloneTools).toEqual([]);
      expect(plan.errors.length).toBe(4);
    });

    it('should format handler results like a callModel result', async () => {
      const tool = mcpAdditionalTool({ name: 'demo_report', description: 'Report.', readOnly: true, expose: 'tool', handler: () => ({ total: 3 }) });
      const result = await tool.definition.staticHandler?.({}, { rawRequest: {} as never });
      expect(result?.structuredContent).toEqual({ total: 3 });
      expect(tool.definition.annotations?.readOnlyHint).toBe(true);
    });
  });
});
