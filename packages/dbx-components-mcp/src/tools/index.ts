/**
 * MCP tool registration for dbx-components.
 *
 * Schema strategy: tools use the low-level `server.setRequestHandler(CallToolRequestSchema, ...)`
 * API with plain JSON Schema `inputSchema` entries (advertised via
 * `tools/list`) and arktype for runtime payload validation inside handlers.
 * The high-level `McpServer.registerTool` API is deliberately avoided because
 * it is zod-coupled — arktype is the workspace standard.
 *
 * Registered tools:
 *
 * | Tool           | Purpose        | One-liner                              |
 * |----------------|----------------|----------------------------------------|
 * | dbx_lookup     | Documentation  | "Tell me about X"                      |
 *
 * Planned (later phases):
 *
 * | Tool           | Purpose        | One-liner                              |
 * |----------------|----------------|----------------------------------------|
 * | dbx_decode     | Decoding       | "What does this Firestore doc mean?"   |
 * | dbx_examples   | Working code   | "Show me how to do X"                  |
 * | dbx_validate   | Verification   | "Is my model/field/action correct?"    |
 * | dbx_scaffold   | Generation     | "Generate boilerplate for X"           |
 * | dbx_search     | Discovery      | "Find topics about X"                  |
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerLookupTool } from './lookup.tool.js';

export function registerTools(server: McpServer): void {
  registerLookupTool(server);
}
