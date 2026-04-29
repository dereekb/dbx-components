/**
 * MCP server for dbx-components.
 *
 * Mirrors the structure of @ng-forge/dynamic-form-mcp — a thin factory that
 * wires registered resources and tools to a stdio transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadActionRegistry, type LoadActionRegistryResult } from './manifest/load-actions-registry.js';
import { loadFilterRegistry, type LoadFilterRegistryResult } from './manifest/load-filters-registry.js';
import { loadForgeFieldRegistry, type LoadForgeFieldRegistryResult } from './manifest/load-forge-fields-registry.js';
import { loadPipeRegistry, type LoadPipeRegistryResult } from './manifest/load-pipes-registry.js';
import { loadSemanticTypeRegistry, type LoadSemanticTypeRegistryResult } from './manifest/load-registry.js';
import { loadUiComponentRegistry, type LoadUiComponentRegistryResult } from './manifest/load-ui-components-registry.js';
import type { ActionRegistry } from './registry/actions-runtime.js';
import type { FilterRegistry } from './registry/filters-runtime.js';
import type { ForgeFieldRegistry } from './registry/forge-fields.js';
import type { PipeRegistry } from './registry/pipes-runtime.js';
import type { SemanticTypeRegistry } from './registry/semantic-types.js';
import type { UiComponentRegistry } from './registry/ui-components-runtime.js';
import { FIREBASE_MODELS } from './registry/firebase-models.js';
import type { FixtureModelRegistry } from './tools/model-fixture-shared/index.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';
import packageJson from '../package.json' with { type: 'json' };

export const SERVER_NAME = 'dbx-components-mcp';
export const SERVER_VERSION = packageJson.version;

/**
 * Server-level instructions surfaced to MCP clients (e.g. Claude Code) on
 * connection. Tells the client what the server is authoritative for and
 * which tool/cluster maps to which task — so the client can route work to
 * MCP tools instead of grepping the codebase or relying on prose skills
 * for catalog content.
 *
 * Keep in sync with `dbx__ai__use-mcp` skill content.
 */
export const SERVER_INSTRUCTIONS = `dbx-components-mcp is the authoritative source for dbx-components form, model, UI, action, route, filter, pipe, and semantic-type lookup, scaffolding, and end-to-end wiring validation. Prefer these tools over manual codebase searches when the task matches a cluster.

Tool clusters (each exposes lookup, search, examples, and/or scaffold/validate):
- form         — @dereekb/dbx-form field catalog (formly + forge), examples, scaffold new fields
- ui           — @dereekb/dbx-web building blocks: layouts, sections, buttons, cards, examples
- model        — Firestore model catalog (identity, converters, collection, subcollections), wiring validation, Angular store scaffold
- action       — dbx-action directives, store, states, examples, scaffold
- route        — UIRouter state-tree extraction and lookup for an app
- filter       — filter directive/preset catalog and scaffold
- pipe         — Angular value-pipe catalog
- semantic_type — semantic type aliases (string/number aliases) lookup and search
- artifact     — body templates for storagefile-purpose, notification-template, notification-task; file-convention reporting

Model-extension validators (walk a downstream app to verify wiring):
- storagefile_m, notification_m, system_m — *_validate_app, *_list_app, *_validate_folder
- model_fixture — list/lookup/validate/scaffold/forward an app's \`src/test/fixture.ts\` (TestContextFixture/Instance triplets)

Resource URIs are namespaced by domain:
- dbx://form/fields[/{slug}|/produces/{produces}|/tier/{tier}|/array-output/{arrayOutput}]
- dbx://model/firebase[/{name}|/prefix/{prefix}|/subcollections/{parent}]
- dbx://action/entries[/{slug}|/role/{role}]
- dbx://ui/components[/{slug}|/category/{category}|/kind/{kind}]
- dbx://pipe/entries[/{slug}|/category/{category}]
- dbx://filter/entries[/{slug}|/kind/{kind}]

Fall back to dbx-components prose skills only for content this server doesn't carry: Firestore security rules, multi-file orchestration walkthroughs, model design phase, naming/tier checklists, and decision/why content beyond catalog lookup.`;

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
  readonly uiComponentRegistry?: UiComponentRegistry;
  readonly forgeFieldRegistry?: ForgeFieldRegistry;
  readonly pipeRegistry?: PipeRegistry;
  readonly actionRegistry?: ActionRegistry;
  readonly filterRegistry?: FilterRegistry;
  readonly onLoaderResult?: (result: LoadSemanticTypeRegistryResult) => void;
  readonly onUiLoaderResult?: (result: LoadUiComponentRegistryResult) => void;
  readonly onForgeLoaderResult?: (result: LoadForgeFieldRegistryResult) => void;
  readonly onPipeLoaderResult?: (result: LoadPipeRegistryResult) => void;
  readonly onActionLoaderResult?: (result: LoadActionRegistryResult) => void;
  readonly onFilterLoaderResult?: (result: LoadFilterRegistryResult) => void;
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
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION
    },
    {
      instructions: SERVER_INSTRUCTIONS
    }
  );

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

  let uiRegistry: UiComponentRegistry | undefined = options.uiComponentRegistry;
  if (uiRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const uiLoaderResult = await loadUiComponentRegistry({ cwd });
      if (options.onUiLoaderResult === undefined) {
        reportUiLoaderResult(uiLoaderResult);
      } else {
        options.onUiLoaderResult(uiLoaderResult);
      }
      uiRegistry = uiLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] ui-components registry unavailable: ${message}\n`);
      uiRegistry = undefined;
    }
  }

  let forgeRegistry: ForgeFieldRegistry | undefined = options.forgeFieldRegistry;
  if (forgeRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const forgeLoaderResult = await loadForgeFieldRegistry({ cwd });
      if (options.onForgeLoaderResult === undefined) {
        reportForgeLoaderResult(forgeLoaderResult);
      } else {
        options.onForgeLoaderResult(forgeLoaderResult);
      }
      forgeRegistry = forgeLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] forge-fields registry unavailable: ${message}\n`);
      forgeRegistry = undefined;
    }
  }

  let pipeRegistry: PipeRegistry | undefined = options.pipeRegistry;
  if (pipeRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const pipeLoaderResult = await loadPipeRegistry({ cwd });
      if (options.onPipeLoaderResult === undefined) {
        reportPipeLoaderResult(pipeLoaderResult);
      } else {
        options.onPipeLoaderResult(pipeLoaderResult);
      }
      pipeRegistry = pipeLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] pipes registry unavailable: ${message}\n`);
      pipeRegistry = undefined;
    }
  }

  let actionRegistry: ActionRegistry | undefined = options.actionRegistry;
  if (actionRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const actionLoaderResult = await loadActionRegistry({ cwd });
      if (options.onActionLoaderResult === undefined) {
        reportActionLoaderResult(actionLoaderResult);
      } else {
        options.onActionLoaderResult(actionLoaderResult);
      }
      actionRegistry = actionLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] actions registry unavailable: ${message}\n`);
      actionRegistry = undefined;
    }
  }

  let filterRegistry: FilterRegistry | undefined = options.filterRegistry;
  if (filterRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const filterLoaderResult = await loadFilterRegistry({ cwd });
      if (options.onFilterLoaderResult === undefined) {
        reportFilterLoaderResult(filterLoaderResult);
      } else {
        options.onFilterLoaderResult(filterLoaderResult);
      }
      filterRegistry = filterLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] filters registry unavailable: ${message}\n`);
      filterRegistry = undefined;
    }
  }

  const fixtureModelRegistry: FixtureModelRegistry = {
    entries: FIREBASE_MODELS.map((m) => ({ name: m.name, modelType: m.modelType, collectionPrefix: m.collectionPrefix }))
  };

  registerResources(server, { semanticTypeRegistry: registry, forgeFieldRegistry: forgeRegistry, pipeRegistry, uiComponentRegistry: uiRegistry, actionRegistry, filterRegistry });
  registerTools(server, { semanticTypeRegistry: registry, forgeFieldRegistry: forgeRegistry, pipeRegistry, uiComponentRegistry: uiRegistry, actionRegistry, filterRegistry, fixtureModelRegistry });

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

/**
 * Default observer used when {@link CreateServerOptions.onUiLoaderResult} is
 * not supplied. Mirrors {@link reportLoaderResult} for the ui-components
 * registry so operators can see the same information for both pipelines.
 *
 * @param result - the loader output to summarise
 */
function reportUiLoaderResult(result: LoadUiComponentRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] ui-components registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] ui-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] ui-loader-warning: ${warning.kind}\n`);
  }
}

/**
 * Default observer used when {@link CreateServerOptions.onForgeLoaderResult}
 * is not supplied. Mirrors {@link reportLoaderResult} for the forge-fields
 * registry so operators can see the same information for all three pipelines.
 *
 * @param result - the loader output to summarise
 */
function reportForgeLoaderResult(result: LoadForgeFieldRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] forge-fields registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] forge-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] forge-loader-warning: ${warning.kind}\n`);
  }
}

/**
 * Default observer used when {@link CreateServerOptions.onPipeLoaderResult}
 * is not supplied. Mirrors {@link reportLoaderResult} for the pipes registry
 * so operators can see the same information for all four pipelines.
 *
 * @param result - the loader output to summarise
 */
function reportPipeLoaderResult(result: LoadPipeRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] pipes registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] pipes-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] pipes-loader-warning: ${warning.kind}\n`);
  }
}

/**
 * Default observer used when {@link CreateServerOptions.onActionLoaderResult}
 * is not supplied. Mirrors {@link reportLoaderResult} for the actions registry
 * so operators can see the same information for all five pipelines.
 *
 * @param result - the loader output to summarise
 */
function reportActionLoaderResult(result: LoadActionRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] actions registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] actions-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] actions-loader-warning: ${warning.kind}\n`);
  }
}

/**
 * Default observer used when {@link CreateServerOptions.onFilterLoaderResult}
 * is not supplied. Mirrors {@link reportLoaderResult} for the filters registry
 * so operators can see the same information for all six pipelines.
 *
 * @param result - the loader output to summarise
 */
function reportFilterLoaderResult(result: LoadFilterRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] filters registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] filters-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] filters-loader-warning: ${warning.kind}\n`);
  }
}
