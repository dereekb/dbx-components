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
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
