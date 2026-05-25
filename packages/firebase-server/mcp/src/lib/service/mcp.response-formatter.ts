import { inspect } from 'node:util';
import { type OnCallTypedModelParams } from '@dereekb/firebase';
import { type McpToolResponseContent, type OnCallModelFunctionApiDetails } from '@dereekb/firebase-server';

/**
 * Resolves a dispatch result + handler API details into the MCP `CallToolResult` shape.
 *
 * Three-tier resolution as documented on {@link OnCallModelFunctionApiDetails.mcp}:
 *
 * - **Tier 3** — when `mcp.formatResponse` is set, its return value is used verbatim.
 * - **Tier 2** — when `mcp.summarizeResponse` is set, the summary string is wrapped into a
 *   single text content block with the raw `result` exposed as `structuredContent`.
 * - **Tier 1** — default: JSON-stringify `result` as a single text content block, also
 *   exposing the raw value as `structuredContent`.
 *
 * @param result - The handler's return value.
 * @param params - The {@link OnCallTypedModelParams} that were dispatched.
 * @param details - The handler-level API details (carries Tier 2/3 formatters).
 * @returns The MCP tool response content.
 */
export function formatMcpToolResponse(result: unknown, params: OnCallTypedModelParams, details: OnCallModelFunctionApiDetails | undefined): McpToolResponseContent {
  const mcp = details?.mcp;
  let response: McpToolResponseContent;

  if (mcp?.formatResponse) {
    response = mcp.formatResponse(result, params);
  } else if (mcp?.summarizeResponse) {
    const summary = mcp.summarizeResponse(result, params);
    response = {
      content: [{ type: 'text', text: summary }],
      structuredContent: result
    };
  } else {
    response = {
      content: [{ type: 'text', text: stringifyResult(result) }],
      structuredContent: result
    };
  }

  return response;
}

/**
 * Converts an error thrown from the dispatch chain into the MCP error response shape.
 *
 * @param error - The thrown error.
 * @returns An MCP tool response with `isError: true` and the error message as a text block.
 */
export function formatMcpToolErrorResponse(error: unknown): McpToolResponseContent {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text', text: message }]
  };
}

function stringifyResult(result: unknown): string {
  let text: string;

  if (result === undefined) {
    text = 'undefined';
  } else if (typeof result === 'string') {
    text = result;
  } else {
    try {
      text = JSON.stringify(result, null, 2);
    } catch {
      text = inspect(result, { depth: 4 });
    }
  }

  return text;
}
