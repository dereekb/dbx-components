/**
 * Central tool dispatcher for dbx-components-mcp.
 *
 * Schema strategy: tools advertise plain JSON Schema `inputSchema` entries
 * (through `tools/list`) and validate payloads with arktype inside each
 * handler. The high-level `McpServer.registerTool` API is deliberately
 * skipped because it is zod-coupled — arktype is the workspace standard.
 *
 * Each tool module exports a {@link DbxTool} containing its definition and
 * `run(args)` handler. This file sets the `tools/list` and `tools/call`
 * request handlers exactly once and routes calls by tool name.
 *
 * Registered tools:
 *
 * | Tool           | Purpose        | One-liner                              |
 * |----------------|----------------|----------------------------------------|
 * | dbx_lookup     | Documentation  | "Tell me about X"                      |
 * | dbx_search     | Discovery      | "Find entries matching keywords"       |
 * | dbx_examples   | Working code   | "Show me how to compose X"             |
 * | dbx_scaffold   | Generation     | "Generate a FormConfig skeleton"       |
 *
 * Planned (later phases):
 *
 * | Tool           | Purpose        | One-liner                              |
 * |----------------|----------------|----------------------------------------|
 * | dbx_decode     | Decoding       | "What does this Firestore doc mean?"   |
 * | dbx_validate   | Verification   | "Is my model/field/action correct?"    |
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { lookupTool } from './lookup.tool.js';
import { searchTool } from './search.tool.js';
import { examplesTool } from './examples.tool.js';
import { scaffoldTool } from './scaffold.tool.js';
import { toolError, type DbxTool } from './types.js';

/**
 * Every registered tool in order of presentation in `tools/list`.
 */
export const DBX_TOOLS: readonly DbxTool[] = [lookupTool, searchTool, examplesTool, scaffoldTool];

export function registerTools(server: McpServer): void {
  const underlyingServer = server.server;

  underlyingServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = { tools: DBX_TOOLS.map((t) => t.definition) };
    return result;
  });

  underlyingServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    const tool = DBX_TOOLS.find((t) => t.definition.name === name);
    if (!tool) {
      return toolError(`Unknown tool: ${name}. Known tools: ${DBX_TOOLS.map((t) => t.definition.name).join(', ')}.`);
    }
    const result = await tool.run(toolArgs);
    return result;
  });
}
