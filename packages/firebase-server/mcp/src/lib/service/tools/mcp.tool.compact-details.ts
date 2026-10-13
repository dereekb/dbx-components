import { type CallToolResult, type ToolAnnotations } from '@modelcontextprotocol/server';
import { type Maybe } from '@dereekb/util';
import { MCP_COMPACT_DETAILS_INPUT_SCHEMA } from '../mcp.compact';
import { type McpManifestModelEntry } from '../mcp.manifest';
import { type McpMethod, type McpMethodKind, type McpMethodView } from '../mcp.method';
import { suggestMcpMethods, type McpMethodSearchEntries } from '../mcp.method.search';
import { buildStaticToolDefinition, type McpStaticToolHandlerContext, type McpToolDefinition, type McpToolListEntry } from '../mcp.tool-generator';
import { MCP_COMPACT_DISPATCH_MODEL_TYPE } from './mcp.tool.compact-search';

/**
 * Synthetic dispatch call identifying the compact details tool.
 */
export const MCP_COMPACT_DETAILS_DISPATCH_CALL = 'details';

/**
 * Output of the compact details tool.
 */
export interface McpCompactDetailsResult {
  readonly method: string;
  readonly kind: McpMethodKind;
  /**
   * The compact tool that runs this method.
   */
  readonly invokeWith: string;
  /**
   * The method's own tool name, present only when it is also listed as a tool.
   */
  readonly tool?: string;
  readonly aliases: readonly string[];
  readonly model?: { readonly type: string; readonly name?: string; readonly group?: string };
  readonly description: string;
  readonly inputSchema: object;
  readonly outputSchema?: object;
  readonly annotations?: ToolAnnotations;
}

/**
 * Dependencies for {@link createMcpCompactDetailsTool}.
 */
export interface CreateMcpCompactDetailsToolDeps {
  readonly name: string;
  readonly app: string;
  readonly searchName: string;
  readonly readName: string;
  readonly writeName: string;
  readonly entries: McpMethodSearchEntries;
  readonly view: McpMethodView;
  readonly models?: Maybe<readonly McpManifestModelEntry[]>;
  /**
   * Whether the method is also listed as its own tool for this request.
   */
  readonly isListedAsTool: (method: McpMethod) => boolean;
  /**
   * Resolves the method's wire entry (running its details builder, without the reason parameter).
   */
  readonly resolveWireEntry: (definition: McpToolDefinition, ctx: McpStaticToolHandlerContext) => McpToolListEntry;
}

/**
 * Builds the request-scoped compact `details` tool.
 *
 * @param deps - The resolved names, visible view, and wire-entry resolver.
 * @returns The tool definition.
 */
export function createMcpCompactDetailsTool(deps: CreateMcpCompactDetailsToolDeps): McpToolDefinition {
  const { name, app, searchName, readName, writeName, entries, view, models, isListedAsTool, resolveWireEntry } = deps;
  const modelsByType = new Map((models ?? []).map((model) => [model.modelType, model]));

  return buildStaticToolDefinition({
    name,
    description: `Get the input (parameter) and output JSON schema for one ${app} API method id returned by \`${searchName}\`.`,
    inputSchema: MCP_COMPACT_DETAILS_INPUT_SCHEMA,
    dispatch: { call: MCP_COMPACT_DETAILS_DISPATCH_CALL, modelType: MCP_COMPACT_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: true,
    omitReasonParameter: true,
    staticHandler: async (args, ctx) => {
      const requested = typeof args['method'] === 'string' ? args['method'] : '';
      const method = view.resolve(requested);
      let response: CallToolResult;

      if (method == null) {
        const suggestions = suggestMcpMethods({ entries, view, name: requested });
        const quoted = suggestions.map((x) => `\`${x}\``).join(', ');
        const hint = suggestions.length > 0 ? ` Did you mean: ${quoted}?` : ` Use \`${searchName}\` to find methods.`;
        response = { isError: true, content: [{ type: 'text', text: `Unknown method: ${requested}.${hint}` }] };
      } else {
        const wire = resolveWireEntry(method.definition, ctx);
        const model = method.modelType == null ? undefined : modelsByType.get(method.modelType);

        const result: McpCompactDetailsResult = {
          method: method.id,
          kind: method.kind,
          invokeWith: method.kind === 'read' ? readName : writeName,
          ...(isListedAsTool(method) ? { tool: method.definition.name } : undefined),
          aliases: method.aliases,
          ...(method.modelType == null ? undefined : { model: { type: method.modelType, ...(model == null ? undefined : { name: model.modelName, ...(model.modelGroup == null ? undefined : { group: model.modelGroup }) }) } }),
          description: wire.description,
          inputSchema: wire.inputSchema,
          ...(wire.outputSchema == null ? undefined : { outputSchema: wire.outputSchema }),
          ...(wire.annotations == null ? undefined : { annotations: wire.annotations })
        };

        response = { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result as unknown as Record<string, unknown> };
      }

      return response;
    }
  });
}
