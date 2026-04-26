/**
 * MCP server for dbx-components.
 *
 * Mirrors the structure of @ng-forge/dynamic-form-mcp — a thin factory that
 * wires registered resources and tools to a stdio transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadSemanticTypeRegistry, type LoadSemanticTypeRegistryResult } from './manifest/load-registry.js';
import type { SemanticTypeRegistry } from './registry/semantic-types.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';
import packageJson from '../package.json' with { type: 'json' };

export const SERVER_NAME = 'dbx-components-mcp';
export const SERVER_VERSION = packageJson.version;

/**
 * Optional bootstrap inputs for {@link createServer}. The defaults match the
 * production wiring — `cwd` defaults to `process.cwd()` so the loader picks
 * up the workspace's `dbx-mcp.config.json` automatically. Tests pass an
 * explicit `cwd` (or a pre-built registry) to drive the bootstrap without
 * touching disk.
 */
export interface CreateServerOptions {
  readonly cwd?: string;
  readonly semanticTypeRegistry?: SemanticTypeRegistry;
  readonly onLoaderResult?: (result: LoadSemanticTypeRegistryResult) => void;
}

/**
 * Builds a fresh `McpServer` and registers every resource/tool exposed by
 * dbx-components-mcp. Returns the configured server without connecting it so
 * tests can mount any transport (stdio, in-memory) without duplicating setup.
 *
 * Side effects: loads the merged semantic-types registry from the bundled
 * `@dereekb/*` manifests plus any external sources declared in
 * `dbx-mcp.config.json`. Loader and config warnings are streamed to stderr
 * (or to `options.onLoaderResult` when supplied) so test harnesses can
 * assert on them.
 *
 * @param options - bootstrap inputs (cwd, pre-built registry, observer hook)
 * @returns a configured server ready to be connected to a transport
 */
export async function createServer(options: CreateServerOptions = {}): Promise<McpServer> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  // McpServer auto-declares capabilities when registerTool/registerResource is
  // called. Our tools go through the low-level setRequestHandler API instead,
  // so we advertise the `tools` capability explicitly. Resources still use
  // McpServer.registerResource, which declares its own capability.
  server.server.registerCapabilities({ tools: {} });

  let registry: SemanticTypeRegistry | undefined = options.semanticTypeRegistry;
  if (registry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    const loaderResult = await loadSemanticTypeRegistry({ cwd });
    if (options.onLoaderResult === undefined) {
      reportLoaderResult(loaderResult);
    } else {
      options.onLoaderResult(loaderResult);
    }
    registry = loaderResult.registry;
  }

  registerResources(server, { semanticTypeRegistry: registry });
  registerTools(server, { semanticTypeRegistry: registry });

  return server;
}

/**
 * Production entry point — creates the server and binds it to a stdio
 * transport so it can be invoked from a Claude Code config block.
 */
export async function runStdioServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Default observer used when {@link CreateServerOptions.onLoaderResult} is
 * not supplied. Emits a single info line on stderr summarising which sources
 * loaded and how many warnings were collected, plus one line per warning so
 * operators can spot misconfiguration without paging through stdio frames.
 *
 * @param result - the loader output to summarise
 */
function reportLoaderResult(result: LoadSemanticTypeRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] semantic-types registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] loader-warning: ${warning.kind}\n`);
  }
}
