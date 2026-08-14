import { createMcpHandler, isJsonContentType, isLegacyRequest, type McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport, toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import { type Request, type Response } from 'express';

/**
 * Handles a single Streamable HTTP JSON-RPC request, building a fresh MCP server for it.
 *
 * Both protocol eras are served, each by its own leg:
 *
 * - **2026-07-28 (modern)** — `createMcpHandler`, which is per-request and stateless by
 *   construction: there is no `Mcp-Session-Id` and no transport bookkeeping.
 * - **2025-era (legacy)** — a `NodeStreamableHTTPServerTransport` in stateless mode, which is
 *   byte-for-byte what this endpoint served before the SDK v2 upgrade.
 *
 * The legacy leg is wired by hand (the SDK's documented `isLegacyRequest` composition) rather
 * than left to `createMcpHandler`'s built-in `legacy: 'stateless'` fallback, because that
 * fallback builds its transport with `sessionIdGenerator` alone and therefore answers in
 * `text/event-stream`. See {@link handleLegacyMcpRequest} for why that framing is not viable
 * here.
 *
 * The caller is expected to have already validated the bearer token (via the
 * OIDC bearer middleware) before this function runs.
 *
 * @param req - The Express request carrying the JSON-RPC body.
 * @param res - The Express response.
 * @param buildServer - Factory producing the MCP server that backs this request.
 */
export async function handleStreamableHttpMcpRequest(req: Request, res: Response, buildServer: () => McpServer): Promise<void> {
  // Hand-wired compositions must reject non-JSON POST bodies themselves — neither the modern
  // entry's routing nor the legacy transport does it on our behalf once we classify up front.
  if (!isJsonContentType(req.headers['content-type'])) {
    res.status(415).json({ statusCode: 415, message: 'Unsupported Media Type' });
    return;
  }

  // `req.body` is already parsed by Nest's body parser, so passing it keeps `toWebRequest` from
  // consuming the underlying stream — the legacy leg still needs to read it below.
  const probe = await toWebRequest(req, req.body);

  if (await isLegacyRequest(probe)) {
    await handleLegacyMcpRequest(req, res, buildServer());
  } else {
    await handleModernMcpRequest(req, res, buildServer);
  }
}

/**
 * Serves one 2026-07-28 request through `createMcpHandler`.
 *
 * `legacy: 'reject'` keeps this leg modern-only — 2025-era traffic never reaches it, having
 * already been routed to {@link handleLegacyMcpRequest}.
 *
 * `responseMode: 'json'` is the modern-leg equivalent of the legacy transport's
 * `enableJsonResponse`, keeping the endpoint on a single `application/json` body. Safe here
 * because no tool handler emits mid-call notifications, which are the only thing `'json'` drops.
 *
 * @param req - The Express request carrying the JSON-RPC body.
 * @param res - The Express response.
 * @param buildServer - Factory producing the MCP server that backs this request.
 */
async function handleModernMcpRequest(req: Request, res: Response, buildServer: () => McpServer): Promise<void> {
  const handler = createMcpHandler(buildServer, { legacy: 'reject', responseMode: 'json' });

  try {
    await toNodeHandler(handler)(req, res, req.body);
  } finally {
    await handler.close();
  }
}

/**
 * Serves one 2025-era request through a stateless `NodeStreamableHTTPServerTransport`.
 *
 * `sessionIdGenerator: undefined` selects stateless mode: the transport binds the server,
 * processes one request, and is discarded.
 *
 * `enableJsonResponse: true` replies with a single `application/json` body instead of framing it
 * as `text/event-stream`. Stateless mode answers exactly one JSON-RPC message per request and the
 * controller only implements POST (there is no standalone SSE stream to keep open), so SSE framing
 * adds nothing while making the endpoint fragile behind proxies that buffer or rewrite streamed
 * responses — the failure that originally pushed the demo app off its dev proxy.
 *
 * @param req - The Express request carrying the JSON-RPC body.
 * @param res - The Express response.
 * @param server - The MCP server instance to back the transport.
 */
async function handleLegacyMcpRequest(req: Request, res: Response, server: McpServer): Promise<void> {
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

  res.on('close', () => {
    void transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
