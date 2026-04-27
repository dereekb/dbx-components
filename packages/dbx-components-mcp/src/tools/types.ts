/**
 * Shared types for dbx-components-mcp tools.
 *
 * Each tool exports a {@link DbxTool} describing its MCP `tools/list` entry
 * and a pure `run(args)` handler. The central dispatcher in `./index.ts`
 * iterates these, sets the `tools/list` and `tools/call` request handlers
 * exactly once, and routes calls by tool name.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Shape of an MCP `tools/call` result. Mirrors the SDK's `CallToolResult` but
 * pinned to the text content subset we produce.
 */
export interface ToolResult {
  readonly content: readonly { readonly type: 'text'; readonly text: string }[];
  readonly isError?: boolean;
}

/**
 * A registered dbx-components-mcp tool. `run` must be synchronous or async and
 * is expected to swallow its own errors, returning `{ isError: true }` rather
 * than throwing, so the dispatcher can emit a clean MCP response either way.
 */
export interface DbxTool {
  readonly definition: Tool;
  run(args: unknown): ToolResult | Promise<ToolResult>;
}

/**
 * Helper that builds a plain text error ToolResult. Used by tool handlers
 * when payload validation fails.
 *
 * @param message - the user-facing error message to embed in the result
 * @returns a `ToolResult` with `isError: true` and the message as text content
 */
export function toolError(message: string): ToolResult {
  const result: ToolResult = { content: [{ type: 'text', text: message }], isError: true };
  return result;
}
