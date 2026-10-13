import { MCP_COMPACT_ROUTER_INPUT_SCHEMA } from '../mcp.compact';
import { type McpMethodKind } from '../mcp.method';
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
   * The name of the other router tool, referenced in the description.
   */
  readonly otherName: string;
}

/**
 * Builds the boot-time shell of a compact `read` / `write` router tool.
 *
 * The factory routes calls to these tools itself (resolving `method` in the caller's visible view); the shell's
 * static handler is never reached and throws if it is.
 *
 * @param deps - The tool name, kind, and the other router's name.
 * @returns The tool definition.
 */
export function createMcpCompactRouterTool(deps: CreateMcpCompactRouterToolDeps): McpToolDefinition {
  const { name, kind, app, otherName } = deps;
  const description = kind === 'read' ? `Call a read-only ${app} API method by id with its params. Write methods are rejected; use \`${otherName}\`.` : `Call a ${app} API method that changes data (create/update/delete/invoke) by id with its params. Read methods are rejected; use \`${otherName}\`.`;

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: MCP_COMPACT_ROUTER_INPUT_SCHEMA,
    dispatch: { call: kind, modelType: MCP_COMPACT_DISPATCH_MODEL_TYPE },
    effectiveReadOnly: kind === 'read',
    staticHandler: () => {
      throw new Error(`The ${name} router is dispatched by the MCP server factory.`);
    }
  });
}
