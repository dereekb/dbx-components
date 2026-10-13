import { type CallToolResult } from '@modelcontextprotocol/server';
import { MCP_COMPACT_SEARCH_INPUT_SCHEMA } from '../mcp.compact';
import { mcpMethodInputPropertyNames, mcpMethodPlainDescription, searchMcpMethods, type McpMethodSearchEntries } from '../mcp.method.search';
import { type McpMethod, type McpMethodKind, type McpMethodView } from '../mcp.method';
import { buildStaticToolDefinition, type McpToolDefinition } from '../mcp.tool-generator';

/**
 * Synthetic dispatch call identifying the compact search tool to dynamic visibility predicates.
 */
export const MCP_COMPACT_SEARCH_DISPATCH_CALL = 'search';

/**
 * Synthetic dispatch model type shared by the compact tools.
 */
export const MCP_COMPACT_DISPATCH_MODEL_TYPE = 'mcp';

/**
 * One result row of the compact search tool.
 */
export interface McpCompactSearchResultEntry {
  readonly method: string;
  readonly kind: McpMethodKind;
  readonly model?: string;
  readonly summary: string;
  /**
   * The top-level parameter names. Call `details` for the full schema.
   */
  readonly params: readonly string[];
}

/**
 * Output of the compact search tool.
 */
export interface McpCompactSearchResult {
  readonly total: number;
  readonly methods: readonly McpCompactSearchResultEntry[];
}

/**
 * Dependencies for {@link createMcpCompactSearchTool}.
 */
export interface CreateMcpCompactSearchToolDeps {
  readonly name: string;
  readonly app: string;
  readonly detailsName: string;
  readonly readName: string;
  readonly writeName: string;
  readonly entries: McpMethodSearchEntries;
  /**
   * The caller's visible methods. Results never leave this view.
   */
  readonly view: McpMethodView;
}

/**
 * Returns the first sentence (or line) of a method description, for search result summaries.
 *
 * @param method - The method.
 * @returns The one-line summary.
 */
export function mcpMethodOneLineSummary(method: McpMethod): string {
  const description = mcpMethodPlainDescription(method).trim();
  const firstLine = description.split('\n')[0] ?? '';
  const sentenceEnd = firstLine.search(/\.\s/);
  return sentenceEnd > 0 ? firstLine.slice(0, sentenceEnd + 1) : firstLine;
}

/**
 * Builds the request-scoped compact `search` tool over the caller's visible methods.
 *
 * @param deps - The resolved names, search entries, and visible view.
 * @returns The tool definition.
 */
export function createMcpCompactSearchTool(deps: CreateMcpCompactSearchToolDeps): McpToolDefinition {
  const { name, app, detailsName, readName, writeName, entries, view } = deps;

  return buildStaticToolDefinition({
    name,
    description: `Search the ${app} API for methods by keyword. Returns method ids with their kind (read/write), model and a one-line summary. Next: \`${detailsName}\` for parameters, then \`${readName}\` / \`${writeName}\`.`,
    inputSchema: MCP_COMPACT_SEARCH_INPUT_SCHEMA,
    dispatch: { call: MCP_COMPACT_SEARCH_DISPATCH_CALL, modelType: MCP_COMPACT_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: true,
    omitReasonParameter: true,
    staticHandler: async (args) => {
      const query = typeof args['query'] === 'string' ? args['query'] : '';
      const model = typeof args['model'] === 'string' ? args['model'] : undefined;
      const kind = args['kind'] === 'read' || args['kind'] === 'write' ? args['kind'] : undefined;
      const limit = typeof args['limit'] === 'number' ? args['limit'] : undefined;
      const found = searchMcpMethods({ entries, view, query, model, kind, limit });

      const result: McpCompactSearchResult = {
        total: found.total,
        methods: found.methods.map((method) => ({
          method: method.id,
          kind: method.kind,
          ...(method.modelType == null ? undefined : { model: method.modelType }),
          summary: mcpMethodOneLineSummary(method),
          params: mcpMethodInputPropertyNames(method)
        }))
      };

      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result as unknown as Record<string, unknown> } satisfies CallToolResult;
    }
  });
}
