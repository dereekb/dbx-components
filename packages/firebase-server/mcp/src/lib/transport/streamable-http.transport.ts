import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { type Request, type Response } from 'express';

/**
 * Handles a single Streamable HTTP JSON-RPC request against the supplied MCP server.
 *
 * Each call creates a fresh `StreamableHTTPServerTransport` in stateless mode — the
 * transport binds the server, processes one request, and is discarded. Stateless
 * mode is adequate for Claude custom-connector usage and avoids the bookkeeping
 * cost of session-tracked transports for the common case.
 *
 * The caller is expected to have already validated the bearer token (via the
 * OIDC bearer middleware) before this function runs.
 *
 * @param req - The Express request carrying the JSON-RPC body.
 * @param res - The Express response.
 * @param server - The MCP server instance to back the transport.
 * @param server.connect - The MCP server's connect method that binds the transport before request handling.
 */
export async function handleStreamableHttpMcpRequest(req: Request, res: Response, server: { connect: (transport: StreamableHTTPServerTransport) => Promise<void> }): Promise<void> {
  // sessionIdGenerator: undefined → stateless mode.
  //
  // enableJsonResponse: true → reply with a single `application/json` body instead of framing it
  // as `text/event-stream`. Stateless mode answers exactly one JSON-RPC message per request and
  // the controller only implements POST (there is no standalone SSE stream to keep open), so SSE
  // framing adds nothing while making the endpoint fragile behind proxies that buffer or rewrite
  // streamed responses — the failure that originally pushed the demo app off its dev proxy.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

  res.on('close', () => {
    void transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
