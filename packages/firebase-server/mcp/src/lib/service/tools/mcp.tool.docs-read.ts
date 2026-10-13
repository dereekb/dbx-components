import { type CallToolResult } from '@modelcontextprotocol/server';
import { buildStaticToolDefinition, type McpToolDefinition } from '../mcp.tool-generator';
import { MCP_DOCS_DISPATCH_MODEL_TYPE, type McpDocsService } from './mcp.tool.docs-search';

/**
 * Reserved name of the built-in docs read method.
 */
export const MCP_DOCS_READ_TOOL_NAME = 'docs-read';

/**
 * Synthetic dispatch call. `read` so the visibility classifier treats it as a read.
 */
export const MCP_DOCS_READ_DISPATCH_CALL = 'read';

/**
 * JSON schema for the docs read method's input.
 */
export const MCP_DOCS_READ_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'The doc id from the documentation search (e.g. "guides/setup").' },
    section: { type: 'string', description: 'Optional section id from the search result or the doc\'s "sections". Reads the whole doc when omitted.' }
  },
  required: ['id'],
  additionalProperties: false
} as const;

/**
 * Dependencies for {@link createMcpDocsReadTool}.
 */
export interface CreateMcpDocsReadToolDeps {
  readonly app: string;
  readonly docsService: McpDocsService;
}

/**
 * Builds the `docs-read` built-in read method: reads a doc (or one section) the caller may see. A hidden doc and a
 * missing doc fail the same way.
 *
 * @param deps - The app label and docs service.
 * @returns The tool definition.
 */
export function createMcpDocsReadTool(deps: CreateMcpDocsReadToolDeps): McpToolDefinition {
  const { app, docsService } = deps;
  const requiredScope = docsService.requiredScope;

  return buildStaticToolDefinition({
    name: MCP_DOCS_READ_TOOL_NAME,
    description: `Read one ${app} documentation page (or one section of it) as markdown, by the doc id the documentation search returns.`,
    inputSchema: MCP_DOCS_READ_INPUT_SCHEMA,
    dispatch: { call: MCP_DOCS_READ_DISPATCH_CALL, modelType: MCP_DOCS_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: true,
    rule: { requireAuthenticated: true },
    ...(requiredScope == null ? undefined : { requiredScopeTerms: [requiredScope] }),
    staticHandler: async (args, ctx) => {
      const id = typeof args['id'] === 'string' ? args['id'] : '';
      const section = typeof args['section'] === 'string' ? args['section'] : undefined;
      const result = docsService.readDoc(ctx.auth, { id, section });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result as unknown as Record<string, unknown> } satisfies CallToolResult;
    }
  });
}
