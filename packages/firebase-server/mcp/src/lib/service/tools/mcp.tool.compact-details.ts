import { type CallToolResult, type ToolAnnotations } from '@modelcontextprotocol/server';
import { type Maybe } from '@dereekb/util';
import { type McpEscalatingParamHints } from '@dereekb/firebase-server';
import { type McpCompactToolNames } from '../../mcp.config';
import { buildMcpCompactDetailsInputSchema } from '../mcp.compact';
import { type McpToolMethodExamples } from '../mcp.examples';
import { type McpManifestModelEntry } from '../mcp.manifest';
import { MCP_METHOD_KINDS, type McpMethod, type McpMethodKind, type McpMethodView } from '../mcp.method';
import { suggestMcpMethods, type McpMethodSearchEntries } from '../mcp.method.search';
import { buildStaticToolDefinition, type McpStaticToolHandlerContext, type McpToolDefinition, type McpToolListEntry } from '../mcp.tool-generator';
import { MCP_COMPACT_DISPATCH_MODEL_TYPE } from './mcp.tool.compact-search';

/**
 * Synthetic dispatch call identifying the compact details tool.
 */
export const MCP_COMPACT_DETAILS_DISPATCH_CALL = 'details';

/**
 * How setting one escalating param changes a call, in {@link McpCompactDetailsResult.escalatingParams}.
 */
export interface McpCompactDetailsEscalatingParam {
  /**
   * The kind of a call that sets this param.
   */
  readonly kind: McpMethodKind;
  /**
   * The compact tool such a call runs through.
   */
  readonly invokeWith: string;
  readonly hints: McpEscalatingParamHints;
}

/**
 * Output of the compact details tool.
 */
export interface McpCompactDetailsResult {
  readonly method: string;
  /**
   * The kind of a call that sets none of {@link escalatingParams}.
   */
  readonly kind: McpMethodKind;
  /**
   * The compact tool that runs a call that sets none of {@link escalatingParams}.
   */
  readonly invokeWith: string;
  /**
   * The params that change a call's kind when set. Present only when the method has any.
   */
  readonly escalatingParams?: Readonly<Record<string, McpCompactDetailsEscalatingParam>>;
  /**
   * The method's own tool name, present only when it is also listed as a tool.
   */
  readonly tool?: string;
  readonly aliases: readonly string[];
  readonly model?: { readonly type: string; readonly name?: string; readonly group?: string };
  readonly description: string;
  readonly inputSchema: object;
  readonly outputSchema?: object;
  /**
   * The method's hints, worst case over every escalating param.
   */
  readonly annotations?: ToolAnnotations;
}

/**
 * Dependencies for {@link createMcpCompactDetailsTool}.
 */
export interface CreateMcpCompactDetailsToolDeps {
  readonly name: string;
  readonly app: string;
  /**
   * The resolved compact tool names.
   */
  readonly names: McpCompactToolNames;
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
  /**
   * Examples drawn from the caller's visible methods. Omit for generic wording.
   */
  readonly examples?: Maybe<McpToolMethodExamples>;
}

/**
 * Returns a copy of a method's input schema whose properties named by an escalating param that raises the call's kind
 * carry a sentence naming the tool to use when they are set.
 *
 * Only the touched properties are copied; the (frozen) wire entry is never mutated. A property that is missing or not an
 * object is skipped.
 *
 * @param inputSchema - The method's resolved input schema.
 * @param method - The method.
 * @param names - The resolved compact tool names.
 * @returns The marked schema, or the input schema itself when nothing is marked.
 */
function markEscalatingParams(inputSchema: object, method: McpMethod, names: McpCompactToolNames): object {
  const properties = (inputSchema as { properties?: unknown }).properties;
  const baseRank = MCP_METHOD_KINDS.indexOf(method.kind);
  const raising = (method.escalatingParams ?? []).filter((x) => MCP_METHOD_KINDS.indexOf(x.kind) > baseRank);
  let result = inputSchema;

  if (raising.length > 0 && properties != null && typeof properties === 'object') {
    const sourceProperties = properties as Record<string, unknown>;
    const markedProperties: Record<string, unknown> = { ...sourceProperties };

    for (const escalation of raising) {
      const property = Object.hasOwn(sourceProperties, escalation.param) ? sourceProperties[escalation.param] : undefined;

      if (property != null && typeof property === 'object') {
        const existing = (property as { description?: unknown }).description;
        const effect = escalation.hints.destructive === true ? 'Setting this lets the call delete or overwrite data' : 'Setting this makes the call send a real message or change another service';
        const sentence = `${effect}; call \`${names[escalation.kind]}\` when it is set.`;
        const description = typeof existing === 'string' && existing.trim().length > 0 ? `${existing.trim()} ${sentence}` : sentence;
        markedProperties[escalation.param] = { ...property, description };
      }
    }

    result = { ...inputSchema, properties: markedProperties };
  }

  return result;
}

/**
 * Builds the request-scoped compact `details` tool.
 *
 * @param deps - The resolved names, visible view, and wire-entry resolver.
 * @returns The tool definition.
 */
export function createMcpCompactDetailsTool(deps: CreateMcpCompactDetailsToolDeps): McpToolDefinition {
  const { name, app, names, entries, view, models, isListedAsTool, resolveWireEntry, examples } = deps;
  const modelsByType = new Map((models ?? []).map((model) => [model.modelType, model]));

  return buildStaticToolDefinition({
    name,
    description: `Get the input (parameter) and output JSON schema for one ${app} API method id returned by \`${names.search}\`.`,
    inputSchema: buildMcpCompactDetailsInputSchema(examples),
    dispatch: { call: MCP_COMPACT_DETAILS_DISPATCH_CALL, modelType: MCP_COMPACT_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: true,
    omitReasonParameter: true,
    // lenient catalog lookups that coerce their own args; their schemas are rebuilt per request with examples
    validateInput: false,
    staticHandler: async (args, ctx) => {
      const requested = typeof args['method'] === 'string' ? args['method'] : '';
      const method = view.resolve(requested);
      let response: CallToolResult;

      if (method == null) {
        const suggestions = suggestMcpMethods({ entries, view, name: requested });
        const quoted = suggestions.map((x) => `\`${x}\``).join(', ');
        const hint = suggestions.length > 0 ? ` Did you mean: ${quoted}?` : ` Use \`${names.search}\` to find methods.`;
        response = { isError: true, content: [{ type: 'text', text: `Unknown method: ${requested}.${hint}` }] };
      } else {
        const wire = resolveWireEntry(method.definition, ctx);
        const model = method.modelType == null ? undefined : modelsByType.get(method.modelType);

        const result: McpCompactDetailsResult = {
          method: method.id,
          kind: method.kind,
          invokeWith: names[method.kind],
          ...(method.escalatingParams == null ? undefined : { escalatingParams: Object.fromEntries(method.escalatingParams.map((x) => [x.param, { kind: x.kind, invokeWith: names[x.kind], hints: x.hints }])) }),
          ...(isListedAsTool(method) ? { tool: method.definition.name } : undefined),
          aliases: method.aliases,
          ...(method.modelType == null ? undefined : { model: { type: method.modelType, ...(model == null ? undefined : { name: model.modelName, ...(model.modelGroup == null ? undefined : { group: model.modelGroup }) }) } }),
          description: wire.description,
          inputSchema: markEscalatingParams(wire.inputSchema, method, names),
          ...(wire.outputSchema == null ? undefined : { outputSchema: wire.outputSchema }),
          ...(wire.annotations == null ? undefined : { annotations: wire.annotations })
        };

        response = { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result as unknown as Record<string, unknown> };
      }

      return response;
    }
  });
}
