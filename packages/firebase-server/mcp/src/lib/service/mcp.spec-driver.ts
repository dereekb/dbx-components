import { CLIENT_CAPABILITIES_META_KEY, CLIENT_INFO_META_KEY, PROTOCOL_VERSION_META_KEY, createMcpHandler } from '@modelcontextprotocol/server';
import { type Request as ExpressRequest } from 'express';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { type McpServerFactoryService } from './mcp.server.factory';

/**
 * Shared in-process driver for this package's `McpServerFactoryService` specs.
 *
 * Test-only, and deliberately not exported from `src/index.ts` — nothing in the published bundle
 * reaches it. It lives beside the service rather than in a `*.spec.ts` so all three factory specs
 * can share one implementation; the filename does not match vitest's test glob, so it is never
 * collected as a suite.
 *
 * Requests are dispatched through `createMcpHandler`, the same per-request, stateless entry
 * `McpController` serves 2026-07-28 traffic with. `handler.fetch` answers in-process, so no socket
 * is opened and the URL below is never dialed.
 */

/**
 * The protocol revision these specs speak. Requests carrying {@link MCP_TEST_ENVELOPE} are
 * classified as modern and served by `createMcpHandler`'s 2026-07-28 leg.
 */
export const MCP_TEST_PROTOCOL_VERSION = '2026-07-28';

/**
 * The `_meta` envelope every modern request must carry. The entry answers `-32602` when any of
 * these keys is missing.
 */
export const MCP_TEST_ENVELOPE = {
  [PROTOCOL_VERSION_META_KEY]: MCP_TEST_PROTOCOL_VERSION,
  [CLIENT_INFO_META_KEY]: { name: 'firebase-server-mcp-spec', version: '1.0.0' },
  [CLIENT_CAPABILITIES_META_KEY]: {}
} as const;

/**
 * Per-request context a spec wants the factory to build its server from.
 */
export interface McpSpecDriverContext {
  readonly auth?: FirebaseServerAuthData;
  /**
   * Partial Express request stub. Specs that exercise header-derived behaviour pass one; the rest
   * leave it undefined and the driver substitutes an empty object.
   */
  readonly rawRequest?: Partial<ExpressRequest>;
}

/**
 * Input for {@link dispatchMcp}.
 */
export interface DispatchMcpInput {
  /**
   * The factory under test.
   */
  readonly factory: McpServerFactoryService;
  /**
   * Auth and raw-request context the server is built from.
   */
  readonly ctx: McpSpecDriverContext;
  /**
   * The spec method to invoke (`tools/call`, `tools/list`, `server/discover`).
   */
  readonly method: string;
  /**
   * The method params, augmented here with the modern `_meta` envelope.
   */
  readonly params: Record<string, unknown>;
  /**
   * Tool name for `tools/call`, mirrored into the required `Mcp-Name` header.
   */
  readonly toolName?: string;
}

/**
 * Dispatches one JSON-RPC request against a freshly-built MCP server.
 *
 * @param input - The factory, context, method, params, and optional tool name.
 * @returns The JSON-RPC `result` payload.
 */
export async function dispatchMcp(input: DispatchMcpInput): Promise<unknown> {
  const { factory, ctx, method, params, toolName } = input;
  const handler = createMcpHandler(() => factory.createServer({ rawRequest: (ctx.rawRequest ?? {}) as ExpressRequest, auth: ctx.auth }), { responseMode: 'json' });

  try {
    const response = await handler.fetch(
      new Request('http://mcp.test/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          // SEP-2243 requires the modern entry's headers and body to agree on the method (and, for
          // tools/call, the tool name); omitting either is answered with -32020.
          'MCP-Protocol-Version': MCP_TEST_PROTOCOL_VERSION,
          'Mcp-Method': method,
          ...(toolName == null ? {} : { 'Mcp-Name': toolName })
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: MCP_TEST_ENVELOPE } })
      })
    );

    const payload = (await response.json()) as { result?: unknown; error?: { code: number; message: string } };

    if (payload.error == null) {
      return payload.result;
    }

    throw new Error(`MCP ${method} failed with ${payload.error.code}: ${payload.error.message}`);
  } finally {
    await handler.close();
  }
}

/**
 * Builds a server and reads its `tools/list` entries.
 *
 * @param factory - The factory under test.
 * @param ctx - Auth and raw-request context the server is built from.
 * @returns The advertised tool entries.
 */
export async function dispatchMcpToolsList<T>(factory: McpServerFactoryService, ctx: McpSpecDriverContext = {}): Promise<ReadonlyArray<T>> {
  const result = (await dispatchMcp({ factory, ctx, method: 'tools/list', params: {} })) as { tools: ReadonlyArray<T> };
  return result.tools;
}

/**
 * Input for {@link dispatchMcpToolCall}.
 */
export interface DispatchMcpToolCallInput {
  /**
   * The factory under test.
   */
  readonly factory: McpServerFactoryService;
  /**
   * Auth and raw-request context the server is built from.
   */
  readonly ctx: McpSpecDriverContext;
  /**
   * The tool to invoke.
   */
  readonly name: string;
  /**
   * The tool arguments. Defaults to none.
   */
  readonly args?: Record<string, unknown>;
}

/**
 * Builds a server and invokes one tool through `tools/call`.
 *
 * @param input - The factory, context, tool name, and arguments.
 * @returns The `CallToolResult` payload, shaped by the caller.
 */
export async function dispatchMcpToolCall<T>(input: DispatchMcpToolCallInput): Promise<T> {
  const { factory, ctx, name, args } = input;
  return (await dispatchMcp({ factory, ctx, method: 'tools/call', params: { name, arguments: args ?? {} }, toolName: name })) as T;
}

/**
 * Builds a server and reads its `server/discover` advertisement — the 2026-07-28 replacement for
 * the `initialize` handshake, and where a server's `instructions` are published.
 *
 * @param factory - The factory under test.
 * @param ctx - Auth and raw-request context the server is built from.
 * @returns The discover result.
 */
export async function dispatchMcpDiscover(factory: McpServerFactoryService, ctx: McpSpecDriverContext = {}): Promise<{ readonly instructions?: string; readonly capabilities?: Record<string, unknown>; readonly supportedVersions?: ReadonlyArray<string> }> {
  return (await dispatchMcp({ factory, ctx, method: 'server/discover', params: {} })) as { instructions?: string; capabilities?: Record<string, unknown>; supportedVersions?: ReadonlyArray<string> };
}
