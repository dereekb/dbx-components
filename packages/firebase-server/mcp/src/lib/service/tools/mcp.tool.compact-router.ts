import { type McpCompactToolNames } from '../../mcp.config';
import { MCP_COMPACT_ROUTER_INPUT_SCHEMA } from '../mcp.compact';
import { MCP_METHOD_KINDS, type McpMethodCallKind, type McpMethodKind, type McpMethodSummary } from '../mcp.method';
import { buildStaticToolDefinition, type McpToolDefinition } from '../mcp.tool-generator';
import { MCP_COMPACT_DISPATCH_MODEL_TYPE } from './mcp.tool.compact-search';

/**
 * Dependencies for {@link createMcpCompactRouterTool}.
 */
export interface CreateMcpCompactRouterToolDeps {
  readonly name: string;
  readonly kind: McpMethodKind;
  readonly app: string;
  /**
   * The resolved compact tool names, referenced in the description.
   */
  readonly names: McpCompactToolNames;
}

/**
 * Builds the description of a compact router tool.
 *
 * @param deps - The router's kind, app name and the resolved compact names.
 * @returns The description, without the write marker.
 */
function mcpCompactRouterDescription(deps: CreateMcpCompactRouterToolDeps): string {
  const { kind, app, names } = deps;
  let description: string;

  switch (kind) {
    case 'read':
      description = `Call a read-only ${app} API method by id with its params. Methods that change data are rejected; use \`${names.write}\` or \`${names.destructive}\`.`;
      break;
    case 'write':
      description = `Call a ${app} API method that adds or changes data without destroying any by id with its params. Read methods (\`${names.read}\`) and destructive calls (\`${names.destructive}\`) are rejected.`;
      break;
    case 'destructive':
      description = `Call a ${app} API method that may delete or overwrite data, or that sends real messages or changes another service, by id with its params. Other calls are rejected; use \`${names.read}\` / \`${names.write}\`. \`${names.details}\` lists the params that make a call destructive.`;
      break;
  }

  return description;
}

/**
 * Builds the boot-time shell of a compact `read` / `write` / `destructive` router tool.
 *
 * The factory routes calls to these tools itself (resolving `method` in the caller's visible view); the shell's
 * static handler is never reached and throws if it is.
 *
 * @param deps - The tool name, kind, app name and the resolved compact names.
 * @returns The tool definition.
 */
export function createMcpCompactRouterTool(deps: CreateMcpCompactRouterToolDeps): McpToolDefinition {
  const { name, kind } = deps;
  const readOnly = kind === 'read';

  return buildStaticToolDefinition({
    name,
    description: mcpCompactRouterDescription(deps),
    inputSchema: MCP_COMPACT_ROUTER_INPUT_SCHEMA,
    dispatch: { call: kind, modelType: MCP_COMPACT_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: readOnly,
    destructive: readOnly ? undefined : kind === 'destructive',
    openWorld: kind === 'destructive' ? true : undefined,
    staticHandler: () => {
      throw new Error(`The ${name} router is dispatched by the MCP server factory.`);
    }
  });
}

/**
 * Input for {@link describeMcpCompactRouterMismatch}.
 */
export interface DescribeMcpCompactRouterMismatchInput {
  readonly method: McpMethodSummary;
  /**
   * The kind of the refused call.
   */
  readonly call: McpMethodCallKind;
  readonly names: McpCompactToolNames;
}

/**
 * Joins param names as backticked code, e.g. "`a` and `b`".
 *
 * @param params - The param names.
 * @param conjunction - The word joining the last two names.
 * @returns The joined text.
 */
function joinMcpParamNames(params: readonly string[], conjunction: string): string {
  const quoted = params.map((x) => `\`${x}\``);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} ${conjunction} ${quoted[quoted.length - 1]}` : (quoted[0] ?? '');
}

/**
 * Describes why a router refused a call whose kind does not match it, naming the router to use instead.
 *
 * @param input - The method, the call's kind and the resolved compact names.
 * @returns The refusal message.
 *
 * @example
 * ```ts
 * // "Setting `sendProbe` makes this call destructive; call `demo_mcp_destructive`."
 * // "`profile.delete` is a destructive method; call `demo_mcp_destructive`."
 * // "`notificationUser.invoke.healthCheck` is a write method unless `sendProbe` is set; call `demo_mcp_write`."
 * ```
 */
export function describeMcpCompactRouterMismatch(input: DescribeMcpCompactRouterMismatchInput): string {
  const { method, call, names } = input;
  const target = `call \`${names[call.kind]}\`.`;
  let message: string;

  if (call.escalatedBy.length > 0) {
    message = `Setting ${joinMcpParamNames(call.escalatedBy, 'and')} makes this call ${call.kind}; ${target}`;
  } else {
    const baseRank = MCP_METHOD_KINDS.indexOf(method.kind);
    const raising = (method.escalatingParams ?? []).filter((x) => MCP_METHOD_KINDS.indexOf(x.kind) > baseRank).map((x) => x.param);
    const unless = raising.length > 0 ? ` unless ${joinMcpParamNames(raising, 'or')} is set` : '';
    message = `\`${method.id}\` is a ${call.kind} method${unless}; ${target}`;
  }

  return message;
}
