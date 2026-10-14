import { type CallToolResult } from '@modelcontextprotocol/server';
import { type Maybe } from '@dereekb/util';
import { type McpCompactToolNames } from '../../mcp.config';
import { MCP_COMPACT_SEARCH_INPUT_SCHEMA } from '../mcp.compact';
import { mcpMethodInputPropertyNames, mcpMethodPlainDescription, searchMcpMethods, type McpMethodSearchEntries } from '../mcp.method.search';
import { isMcpMethodKind, type McpMethod, type McpMethodKind, type McpMethodView } from '../mcp.method';
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
  /**
   * The kind of a call that sets none of {@link escalatingParams}.
   */
  readonly kind: McpMethodKind;
  readonly model?: string;
  readonly summary: string;
  /**
   * The top-level parameter names. Call `details` for the full schema.
   */
  readonly params: readonly string[];
  /**
   * The params that change a call's kind when set, mapped to that kind. Present only when the method has any.
   */
  readonly escalatingParams?: Readonly<Record<string, McpMethodKind>>;
}

/**
 * Output of the compact search tool.
 */
export interface McpCompactSearchResult {
  readonly total: number;
  readonly methods: readonly McpCompactSearchResultEntry[];
  /**
   * Present (`true`) when no method matched every keyword, so {@link methods} match only some of them.
   */
  readonly partial?: true;
  /**
   * How to search again. Present when the results are partial, or when a non-empty query matched nothing.
   */
  readonly hint?: string;
}

/**
 * Hint returned when no method matched every keyword.
 */
export const MCP_COMPACT_SEARCH_PARTIAL_HINT = 'No method matched every keyword; these match some of them. Search again with fewer keywords, e.g. a verb and a model.';

/**
 * Hint returned when a non-empty query matched nothing.
 */
export const MCP_COMPACT_SEARCH_NO_MATCH_HINT = 'No method matched. Search with one or two keywords, such as a model name or a verb (`create`, `delete`), or pass an empty query with `model` to list the methods of that model.';

/**
 * Dependencies for {@link createMcpCompactSearchTool}.
 */
export interface CreateMcpCompactSearchToolDeps {
  readonly name: string;
  readonly app: string;
  /**
   * The resolved compact tool names, referenced in the description.
   */
  readonly names: McpCompactToolNames;
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
  const { name, app, names, entries, view } = deps;

  return buildStaticToolDefinition({
    name,
    description: `Search the ${app} API for methods by keyword. Pass one to three keywords, not a sentence: a verb and/or a model, e.g. 'create worker' or 'reopen timesheet'. Common verbs also match their synonyms (remove finds delete, add finds create, list finds query). Returns method ids with their kind (read/write/destructive), model and a one-line summary. Next: \`${names.details}\` for parameters, then \`${names.read}\` / \`${names.write}\` / \`${names.destructive}\`.`,
    inputSchema: MCP_COMPACT_SEARCH_INPUT_SCHEMA,
    dispatch: { call: MCP_COMPACT_SEARCH_DISPATCH_CALL, modelType: MCP_COMPACT_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: true,
    omitReasonParameter: true,
    staticHandler: async (args) => {
      const query = typeof args['query'] === 'string' ? args['query'] : '';
      const model = typeof args['model'] === 'string' ? args['model'] : undefined;
      const kind = isMcpMethodKind(args['kind']) ? args['kind'] : undefined;
      const limit = typeof args['limit'] === 'number' ? args['limit'] : undefined;
      const found = searchMcpMethods({ entries, view, query, model, kind, limit });
      let hint: Maybe<string>;

      if (found.partial) {
        hint = MCP_COMPACT_SEARCH_PARTIAL_HINT;
      } else if (found.total === 0 && query.trim().length > 0) {
        hint = MCP_COMPACT_SEARCH_NO_MATCH_HINT;
      }

      const result: McpCompactSearchResult = {
        total: found.total,
        ...(found.partial ? { partial: true } : undefined),
        ...(hint == null ? undefined : { hint }),
        methods: found.methods.map((method) => ({
          method: method.id,
          kind: method.kind,
          ...(method.modelType == null ? undefined : { model: method.modelType }),
          summary: mcpMethodOneLineSummary(method),
          params: mcpMethodInputPropertyNames(method),
          ...(method.escalatingParams == null ? undefined : { escalatingParams: Object.fromEntries(method.escalatingParams.map((x) => [x.param, x.kind])) })
        }))
      };

      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result as unknown as Record<string, unknown> } satisfies CallToolResult;
    }
  });
}
