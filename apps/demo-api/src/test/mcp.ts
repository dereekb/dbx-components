import { type Request as ExpressRequest } from 'express';
import { CLIENT_CAPABILITIES_META_KEY, CLIENT_INFO_META_KEY, PROTOCOL_VERSION_META_KEY, createMcpHandler, type CallToolResult, type Tool } from '@modelcontextprotocol/server';
import { McpServerFactoryService } from '@dereekb/firebase-server/mcp';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { createTestFunctionContextAuthData } from '@dereekb/firebase-server/test';
import { type DemoApiAuthorizedUserTestContextFixture, type DemoApiFunctionContextFixture } from './fixture';

/**
 * In-process driver for the demo-api MCP surface.
 *
 * Resolves {@link McpServerFactoryService} from the Nest test module and drives it through
 * `createMcpHandler` — the same per-request, stateless entry `McpController` serves 2026-07-28
 * traffic with. `handler.fetch` answers in-process, so no socket is ever opened and the URL below
 * is never dialed.
 */

/**
 * The protocol revision these tests speak. Requests carrying the `_meta` envelope below are
 * classified as modern and served by `createMcpHandler`'s 2026-07-28 leg.
 */
const MCP_TEST_PROTOCOL_VERSION = '2026-07-28';

/**
 * The `_meta` envelope every modern request must carry. The entry rejects a request with
 * `-32602` when any of these keys is missing.
 */
const MCP_TEST_ENVELOPE = {
  [PROTOCOL_VERSION_META_KEY]: MCP_TEST_PROTOCOL_VERSION,
  [CLIENT_INFO_META_KEY]: { name: 'demo-api-test', version: '1.0.0' },
  [CLIENT_CAPABILITIES_META_KEY]: {}
} as const;

/**
 * Input for {@link dispatchMcpRequest}.
 */
interface DispatchMcpRequestInput {
  /**
   * The Nest-resolved MCP server factory under test.
   */
  readonly factory: McpServerFactoryService;
  /**
   * The caller's Firebase auth data, or `undefined` for an anonymous call.
   */
  readonly auth: FirebaseServerAuthData | undefined;
  /**
   * The spec method to invoke (`tools/call`, `tools/list`).
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
 * @param input - The factory, auth, method, params, and optional tool name.
 * @returns The JSON-RPC `result` payload.
 */
async function dispatchMcpRequest(input: DispatchMcpRequestInput): Promise<unknown> {
  const { factory, auth, method, params, toolName } = input;
  const handler = createMcpHandler(() => factory.createServer({ auth, rawRequest: {} as ExpressRequest }), { responseMode: 'json' });

  try {
    const response = await handler.fetch(
      new Request('http://demo-api.test/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          // SEP-2243 requires the modern entry's header and body to agree on the method (and, for
          // tools/call, the tool name); a mismatch or omission is answered with -32020.
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

async function loadAuthData(u: DemoApiAuthorizedUserTestContextFixture, scopes?: string): Promise<FirebaseServerAuthData> {
  const userRecord = await u.loadUserRecord();
  const authData = (await createTestFunctionContextAuthData(u.instance.testContext.auth, userRecord)) as FirebaseServerAuthData;
  // When `scopes` is provided, attach a validated OIDC token so the MCP scope filter treats the
  // caller as an OIDC bearer (matching how `McpServerFactoryService` resolves scopes). Omitting it
  // leaves the caller as a plain Firebase auth, which bypasses scope filtering.
  return scopes == null ? authData : ({ ...authData, oidcValidatedToken: { sub: authData.uid, scope: scopes } } as unknown as FirebaseServerAuthData);
}

/**
 * Parameters for {@link callMcpTool}.
 */
export interface CallMcpToolParams {
  /**
   * Demo-api function fixture providing the Nest module + Firebase Auth.
   */
  readonly f: DemoApiFunctionContextFixture;
  /**
   * Authorized user fixture whose Firebase Auth identity scopes the call.
   */
  readonly u: DemoApiAuthorizedUserTestContextFixture;
  /**
   * MCP tool name (e.g. `'guestbookEntry-invoke-recomputeLikes'`).
   */
  readonly name: string;
  /**
   * Tool arguments forwarded to call-model dispatch as the `data` envelope.
   */
  readonly args: Record<string, unknown>;
  /**
   * Optional space-delimited OIDC scope string. When set, the caller is treated as an OIDC bearer
   * carrying these scopes (exercising the per-verb + per-function scope filter); omit for a plain
   * Firebase caller that bypasses scope filtering.
   */
  readonly scopes?: string;
}

/**
 * Parameters for {@link callMcpToolAnonymous}.
 */
export interface CallMcpToolAnonymousParams {
  /**
   * Demo-api function fixture providing the Nest module.
   */
  readonly f: DemoApiFunctionContextFixture;
  /**
   * MCP tool name to dispatch.
   */
  readonly name: string;
  /**
   * Tool arguments forwarded as the `data` envelope.
   */
  readonly args: Record<string, unknown>;
}

/**
 * Dispatches a single MCP `tools/call` through the real dispatch chain as an authenticated user.
 *
 * @param params - Config object with `{ f, u, name, args }`.
 * @returns The MCP `CallToolResult` — including `structuredContent` for the handler's raw return.
 */
export async function callMcpTool(params: CallMcpToolParams): Promise<CallToolResult> {
  const { f, u, name, args, scopes } = params;
  const factory = f.instance.nest.get(McpServerFactoryService);
  const auth = await loadAuthData(u, scopes);
  return (await dispatchMcpRequest({ factory, auth, method: 'tools/call', params: { name, arguments: args }, toolName: name })) as CallToolResult;
}

/**
 * Dispatches a `tools/call` with no auth context — used to prove the dispatch chain still
 * rejects unauthenticated callers when invoked through the MCP surface.
 *
 * @param params - Config object with `{ f, name, args }`.
 * @returns The MCP `CallToolResult` (expected to have `isError: true`).
 */
export async function callMcpToolAnonymous(params: CallMcpToolAnonymousParams): Promise<CallToolResult> {
  const { f, name, args } = params;
  const factory = f.instance.nest.get(McpServerFactoryService);
  return (await dispatchMcpRequest({ factory, auth: undefined, method: 'tools/call', params: { name, arguments: args }, toolName: name })) as CallToolResult;
}

/**
 * Returns the registered tool definitions from `tools/list`.
 *
 * @param f - Demo-api function fixture providing the Nest module.
 * @param u - Authorized user fixture (auth is required by the factory; tool listing itself is auth-insensitive).
 * @param scopes - Optional space-delimited OIDC scope string. When set, the caller is treated as an
 *   OIDC bearer carrying these scopes so the scope filter applies; omit for a plain Firebase caller.
 * @returns The list of registered MCP {@link Tool} definitions.
 */
export async function listMcpTools(f: DemoApiFunctionContextFixture, u: DemoApiAuthorizedUserTestContextFixture, scopes?: string): Promise<ReadonlyArray<Tool>> {
  const factory = f.instance.nest.get(McpServerFactoryService);
  const auth = await loadAuthData(u, scopes);
  const result = (await dispatchMcpRequest({ factory, auth, method: 'tools/list', params: {} })) as { tools: ReadonlyArray<Tool> };
  return result.tools;
}
