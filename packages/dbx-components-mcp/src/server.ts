/**
 * MCP server for dbx-components.
 *
 * Mirrors the structure of @ng-forge/dynamic-form-mcp — a thin factory that
 * wires registered resources and tools to a stdio transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';
import packageJson from '../package.json' with { type: 'json' };

export const SERVER_NAME = 'dbx-components-mcp';
export const SERVER_VERSION = packageJson.version;

/**
 * Builds a fresh `McpServer` and registers every resource/tool exposed by
 * dbx-components-mcp. Returns the configured server without connecting it so
 * tests can mount any transport (stdio, in-memory) without duplicating setup.
 *
 * @returns a configured server ready to be connected to a transport
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  // McpServer auto-declares capabilities when registerTool/registerResource is
  // called. Our tools go through the low-level setRequestHandler API instead,
  // so we advertise the `tools` capability explicitly. Resources still use
  // McpServer.registerResource, which declares its own capability.
  server.server.registerCapabilities({ tools: {} });

  registerResources(server);
  registerTools(server);

  return server;
}

/**
 * Production entry point — creates the server and binds it to a stdio
 * transport so it can be invoked from a Claude Code config block.
 */
export async function runStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
