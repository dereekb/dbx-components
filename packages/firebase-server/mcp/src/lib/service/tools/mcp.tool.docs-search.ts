import { type CallToolResult } from '@modelcontextprotocol/server';
import { type DocsApiService } from '@dereekb/firebase-server';
import { buildStaticToolDefinition, type McpToolDefinition } from '../mcp.tool-generator';

/**
 * Synthetic dispatch call identifying the docs search tool to dynamic visibility predicates.
 */
export const MCP_DOCS_SEARCH_DISPATCH_CALL = 'search';

/**
 * Synthetic dispatch model type shared by the docs tools.
 */
export const MCP_DOCS_DISPATCH_MODEL_TYPE = 'docs';

/**
 * The docs service surface the MCP docs tools use.
 */
export type McpDocsService = Pick<DocsApiService, 'searchDocs' | 'readDoc' | 'countVisibleDocs' | 'docCount' | 'requiredScope'>;

/**
 * JSON schema for the docs search tool's input.
 */
export const MCP_DOCS_SEARCH_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Keywords to search the docs for.' },
    limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum results (default 8).' }
  },
  required: ['query'],
  additionalProperties: false
} as const;

/**
 * Dependencies for {@link createMcpDocsSearchTool}.
 */
export interface CreateMcpDocsSearchToolDeps {
  readonly name: string;
  readonly app: string;
  /**
   * How to read a result, e.g. "`demo_api_read` with `method: \"docs-read\"`".
   */
  readonly readHint: string;
  readonly docsService: McpDocsService;
}

/**
 * Builds the standalone documentation search tool. The factory lists it only for authenticated callers who can see at
 * least one doc; the docs service enforces the audiences and scope on every call.
 *
 * @param deps - The tool name, app label, read hint, and docs service.
 * @returns The tool definition.
 */
export function createMcpDocsSearchTool(deps: CreateMcpDocsSearchToolDeps): McpToolDefinition {
  const { name, app, readHint, docsService } = deps;
  const requiredScope = docsService.requiredScope;

  return buildStaticToolDefinition({
    name,
    description: `Search the ${app} documentation (guides and how-tos) by keyword, matching doc titles, tags, descriptions and section headings. Returns doc ids, matching section ids and doc descriptions. Read a doc or one section with ${readHint}, passing \`{ id, section? }\`.`,
    inputSchema: MCP_DOCS_SEARCH_INPUT_SCHEMA,
    dispatch: { call: MCP_DOCS_SEARCH_DISPATCH_CALL, modelType: MCP_DOCS_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: true,
    omitReasonParameter: true,
    rule: { requireAuthenticated: true },
    ...(requiredScope == null ? undefined : { requiredScopeTerms: [requiredScope] }),
    staticHandler: async (args, ctx) => {
      const query = typeof args['query'] === 'string' ? args['query'] : '';
      const limit = typeof args['limit'] === 'number' ? args['limit'] : undefined;
      const result = docsService.searchDocs(ctx.auth, { query, limit });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result as unknown as Record<string, unknown> } satisfies CallToolResult;
    }
  });
}
