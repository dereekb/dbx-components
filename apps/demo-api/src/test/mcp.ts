import { type Request } from 'express';
import { type CallToolResult, CallToolRequestSchema, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { McpServerFactoryService } from '@dereekb/firebase-server/mcp';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { createTestFunctionContextAuthData } from '@dereekb/firebase-server/test';
import { type DemoApiAuthorizedUserTestContextFixture, type DemoApiFunctionContextFixture } from './fixture';

/**
 * In-process driver for the demo-api MCP surface.
 *
 * Resolves {@link McpServerFactoryService} from the Nest test module and invokes its
 * registered `tools/list` and `tools/call` handlers directly — the same code path the
 * real `McpController` runs, but without the Streamable HTTP transport. Mirrors
 * the handler-extraction trick used by `packages/firebase-server/mcp/.../mcp.server.factory.spec.ts`.
 */

type RequestHandlersMap = Map<string, (req: { method: string; params: unknown }, extra: unknown) => Promise<unknown>>;

function getRequestHandlers(factory: McpServerFactoryService, auth: FirebaseServerAuthData | undefined): RequestHandlersMap {
  const server = factory.createServer({ auth, rawRequest: {} as Request });
  return (server.server as unknown as { _requestHandlers: RequestHandlersMap })._requestHandlers;
}

async function loadAuthData(u: DemoApiAuthorizedUserTestContextFixture): Promise<FirebaseServerAuthData> {
  const userRecord = await u.loadUserRecord();
  const authData = await createTestFunctionContextAuthData(u.instance.testContext.auth, userRecord);
  return authData as FirebaseServerAuthData;
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
  const { f, u, name, args } = params;
  const factory = f.instance.nest.get(McpServerFactoryService);
  const auth = await loadAuthData(u);
  const handlers = getRequestHandlers(factory, auth);
  const callHandler = handlers.get(CallToolRequestSchema.shape.method.value);

  if (!callHandler) {
    throw new Error('MCP CallToolRequest handler was not registered on the server.');
  }

  return (await callHandler({ method: 'tools/call', params: { name, arguments: args } }, {})) as CallToolResult;
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
  const handlers = getRequestHandlers(factory, undefined);
  const callHandler = handlers.get(CallToolRequestSchema.shape.method.value);

  if (!callHandler) {
    throw new Error('MCP CallToolRequest handler was not registered on the server.');
  }

  return (await callHandler({ method: 'tools/call', params: { name, arguments: args } }, {})) as CallToolResult;
}

/**
 * Returns the registered tool definitions from `tools/list`.
 *
 * @param f - Demo-api function fixture providing the Nest module.
 * @param u - Authorized user fixture (auth is required by the factory; tool listing itself is auth-insensitive).
 * @returns The list of registered MCP {@link Tool} definitions.
 */
export async function listMcpTools(f: DemoApiFunctionContextFixture, u: DemoApiAuthorizedUserTestContextFixture): Promise<ReadonlyArray<Tool>> {
  const factory = f.instance.nest.get(McpServerFactoryService);
  const auth = await loadAuthData(u);
  const handlers = getRequestHandlers(factory, auth);
  const listHandler = handlers.get(ListToolsRequestSchema.shape.method.value);

  if (!listHandler) {
    throw new Error('MCP ListToolsRequest handler was not registered on the server.');
  }

  const result = (await listHandler({ method: 'tools/list', params: {} }, {})) as { tools: ReadonlyArray<Tool> };
  return result.tools;
}
