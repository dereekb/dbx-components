/**
 * MCP tool registration for dbx-components.
 *
 * Schema strategy: arktype for payload validation (workspace standard), paired
 * with the MCP SDK's lower-level `server.registerTool({ inputSchema })` or
 * `server.setRequestHandler(CallToolRequestSchema, ...)` APIs that accept
 * plain JSON Schema. The high-level `server.tool(name, zodShape, cb)` API is
 * deliberately not used because it is zod-coupled.
 *
 * Planned tools (registered incrementally as domains come online):
 *
 * | Tool           | Purpose        | One-liner                              |
 * |----------------|----------------|----------------------------------------|
 * | dbx_lookup     | Documentation  | "Tell me about X"                      |
 * | dbx_decode     | Decoding       | "What does this Firestore doc mean?"   |
 * | dbx_examples   | Working code   | "Show me how to do X"                  |
 * | dbx_validate   | Verification   | "Is my model/field/action correct?"    |
 * | dbx_scaffold   | Generation     | "Generate boilerplate for X"           |
 * | dbx_search     | Discovery      | "Find topics about X"                  |
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTools(_server: McpServer): void {
  // Intentionally empty — tool implementations land with their domain content.
}
