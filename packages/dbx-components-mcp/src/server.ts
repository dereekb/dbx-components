/**
 * MCP server for dbx-components.
 *
 * Mirrors the structure of @ng-forge/dynamic-form-mcp — a thin factory that
 * wires registered resources and tools to a stdio transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { findAndLoadConfig } from './config/load-config.js';
import { loadActionRegistry, type LoadActionRegistryResult } from './manifest/load-actions-registry.js';
import { loadFilterRegistry, type LoadFilterRegistryResult } from './manifest/load-filters-registry.js';
import { loadForgeFieldRegistry, type LoadForgeFieldRegistryResult } from './manifest/load-forge-fields-registry.js';
import { loadPipeRegistry, type LoadPipeRegistryResult } from './manifest/load-pipes-registry.js';
import { loadSemanticTypeRegistry, type LoadSemanticTypeRegistryResult } from './manifest/load-registry.js';
import { loadTokenRegistry, type LoadTokenRegistryResult } from './manifest/load-tokens-registry.js';
import { loadCssUtilityRegistry, type LoadCssUtilityRegistryResult } from './manifest/load-css-utilities-registry.js';
import { loadUiComponentRegistry, type LoadUiComponentRegistryResult } from './manifest/load-ui-components-registry.js';
import { loadDbxDocsUiExamplesRegistry, type LoadDbxDocsUiExamplesRegistryResult } from './manifest/load-dbx-docs-ui-examples-registry.js';
import type { ActionRegistry } from './registry/actions-runtime.js';
import type { FilterRegistry } from './registry/filters-runtime.js';
import type { ForgeFieldRegistry } from './registry/forge-fields.js';
import type { PipeRegistry } from './registry/pipes-runtime.js';
import type { SemanticTypeRegistry } from './registry/semantic-types.js';
import type { TokenRegistry } from './registry/tokens-runtime.js';
import type { CssUtilityRegistry } from './registry/css-utilities-runtime.js';
import type { UiComponentRegistry } from './registry/ui-components-runtime.js';
import type { DbxDocsUiExamplesRegistry } from './registry/dbx-docs-ui-examples-runtime.js';
import { FIREBASE_MODELS } from './registry/firebase-models.js';
import type { FixtureModelRegistry } from './tools/model-fixture-shared/index.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';
import type { RuleOptions } from './tools/model-validate/index.js';
import { discoverDownstreamPackages, DOWNSTREAM_CLUSTERS, type DownstreamCluster, type DownstreamPackage } from './scan/discover-downstream-packages.js';
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
- asset        — \`AssetPathRef\` constants in a \`-firebase\` component + \`provideDbxAssetLoader()\` wiring in the Angular app; list/scaffold/validate

Model-extension validators (walk a downstream app to verify wiring):
- storagefile_m, notification_m, system_m — *_validate_app, *_list_app, *_validate_folder
- asset — *_validate_app, *_list_app, *_validate_folder, *_scaffold (component-side \`assets.ts\` + Angular front-end wiring)
- model_fixture — list/lookup/validate/scaffold/forward an app's \`src/test/fixture.ts\` (TestContextFixture/Instance triplets)

Resource URIs are namespaced by domain:
- dbx://form/fields[/{slug}|/produces/{produces}|/tier/{tier}|/array-output/{arrayOutput}]
- dbx://model/firebase[/{name}|/prefix/{prefix}|/subcollections/{parent}]
- dbx://action/entries[/{slug}|/role/{role}]
- dbx://ui/components[/{slug}|/category/{category}|/kind/{kind}]
- dbx://pipe/entries[/{slug}|/category/{category}]
- dbx://filter/entries[/{slug}|/kind/{kind}]
- dbx://token/entries[/{cssVariable}|/source/{source}|/role/{role}]
- dbx://css-utility/entries[/{slug}|/role/{role}|/source/{source}]

UI styling reverse/forward lookup:
- dbx_css_token_lookup — forward: intent/value/role/component → recommended \`var(--…)\` + utility class + dbx-web primitive.
- dbx_css_class_lookup — forward + reverse: name/intent/declarations → canonical dbx-web utility class (e.g. \`.dbx-flex-fill-0\`) with file:line + match diff. **Run this before authoring new SCSS rules** so existing utilities are reused instead of re-implemented.
- dbx_ui_smell_check   — reverse: paste component HTML/SCSS, get smells + canonical fix. **Run this after writing component SCSS** so hardcoded paddings/radii/shadows/colors get caught before they ship.

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
  readonly dbxDocsUiExamplesRegistry?: DbxDocsUiExamplesRegistry;
  readonly forgeFieldRegistry?: ForgeFieldRegistry;
  readonly pipeRegistry?: PipeRegistry;
  readonly actionRegistry?: ActionRegistry;
  readonly filterRegistry?: FilterRegistry;
  readonly tokenRegistry?: TokenRegistry;
  readonly cssUtilityRegistry?: CssUtilityRegistry;
  readonly onLoaderResult?: (result: LoadSemanticTypeRegistryResult) => void;
  readonly onUiLoaderResult?: (result: LoadUiComponentRegistryResult) => void;
  readonly onDbxDocsUiExamplesLoaderResult?: (result: LoadDbxDocsUiExamplesRegistryResult) => void;
  readonly onForgeLoaderResult?: (result: LoadForgeFieldRegistryResult) => void;
  readonly onPipeLoaderResult?: (result: LoadPipeRegistryResult) => void;
  readonly onActionLoaderResult?: (result: LoadActionRegistryResult) => void;
  readonly onFilterLoaderResult?: (result: LoadFilterRegistryResult) => void;
  readonly onTokenLoaderResult?: (result: LoadTokenRegistryResult) => void;
  readonly onCssUtilityLoaderResult?: (result: LoadCssUtilityRegistryResult) => void;
  readonly onDownstreamHints?: (hints: readonly DownstreamHint[]) => void;
}

/**
 * One hint emitted at startup when a downstream package looks like it
 * provides entries for a cluster but no external manifest is registered.
 * Hints are calculated once after every loader completes; the default
 * observer prints them to stderr alongside the per-cluster summary lines.
 */
export interface DownstreamHint {
  readonly cluster: DownstreamCluster;
  readonly packages: readonly DownstreamPackage[];
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

  const externalCounts: Partial<Record<DownstreamCluster, number>> = {};

  const cwdForConfig = options.cwd ?? process.cwd();
  const configResult = await findAndLoadConfig({ cwd: cwdForConfig });
  for (const warning of configResult.warnings) {
    process.stderr.write(`[dbx-components-mcp] config-warning: ${warning.kind} ${warning.path}\n`);
  }
  const modelValidateRuleOptions = resolveModelValidateRuleOptions(configResult.config);

  let registry: SemanticTypeRegistry | undefined = options.semanticTypeRegistry;
  if (registry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    const loaderResult = await loadSemanticTypeRegistry({ cwd });
    externalCounts.semanticTypes = loaderResult.externalSourceCount;
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
      externalCounts.uiComponents = uiLoaderResult.externalSourceCount;
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

  let dbxDocsUiExamplesRegistry: DbxDocsUiExamplesRegistry | undefined = options.dbxDocsUiExamplesRegistry;
  if (dbxDocsUiExamplesRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const examplesLoaderResult = await loadDbxDocsUiExamplesRegistry({ cwd });
      if (options.onDbxDocsUiExamplesLoaderResult === undefined) {
        reportDbxDocsUiExamplesLoaderResult(examplesLoaderResult);
      } else {
        options.onDbxDocsUiExamplesLoaderResult(examplesLoaderResult);
      }
      dbxDocsUiExamplesRegistry = examplesLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] dbx-docs-ui-examples registry unavailable: ${message}\n`);
      dbxDocsUiExamplesRegistry = undefined;
    }
  }

  let forgeRegistry: ForgeFieldRegistry | undefined = options.forgeFieldRegistry;
  if (forgeRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const forgeLoaderResult = await loadForgeFieldRegistry({ cwd });
      externalCounts.forgeFields = forgeLoaderResult.externalSourceCount;
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
      externalCounts.pipes = pipeLoaderResult.externalSourceCount;
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
      externalCounts.actions = actionLoaderResult.externalSourceCount;
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
      externalCounts.filters = filterLoaderResult.externalSourceCount;
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

  let tokenRegistry: TokenRegistry | undefined = options.tokenRegistry;
  if (tokenRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const tokenLoaderResult = await loadTokenRegistry({ cwd });
      if (options.onTokenLoaderResult === undefined) {
        reportTokenLoaderResult(tokenLoaderResult);
      } else {
        options.onTokenLoaderResult(tokenLoaderResult);
      }
      tokenRegistry = tokenLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] tokens registry unavailable: ${message}\n`);
      tokenRegistry = undefined;
    }
  }

  let cssUtilityRegistry: CssUtilityRegistry | undefined = options.cssUtilityRegistry;
  if (cssUtilityRegistry === undefined) {
    const cwd = options.cwd ?? process.cwd();
    try {
      const cssUtilityLoaderResult = await loadCssUtilityRegistry({ cwd });
      if (options.onCssUtilityLoaderResult === undefined) {
        reportCssUtilityLoaderResult(cssUtilityLoaderResult);
      } else {
        options.onCssUtilityLoaderResult(cssUtilityLoaderResult);
      }
      cssUtilityRegistry = cssUtilityLoaderResult.registry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[dbx-components-mcp] css-utilities registry unavailable: ${message}\n`);
      cssUtilityRegistry = undefined;
    }
  }

  const fixtureModelRegistry: FixtureModelRegistry = {
    entries: FIREBASE_MODELS.map((m) => ({ name: m.name, modelType: m.modelType, collectionPrefix: m.collectionPrefix }))
  };

  await emitDownstreamHints({ cwd: options.cwd ?? process.cwd(), externalCounts, onDownstreamHints: options.onDownstreamHints });

  registerResources(server, { semanticTypeRegistry: registry, forgeFieldRegistry: forgeRegistry, pipeRegistry, uiComponentRegistry: uiRegistry, actionRegistry, filterRegistry, tokenRegistry, cssUtilityRegistry });
  registerTools(server, { semanticTypeRegistry: registry, forgeFieldRegistry: forgeRegistry, pipeRegistry, uiComponentRegistry: uiRegistry, dbxDocsUiExamplesRegistry, actionRegistry, filterRegistry, tokenRegistry, cssUtilityRegistry, fixtureModelRegistry, modelValidateRuleOptions, cwd: options.cwd ?? process.cwd() });

  return server;
}

/**
 * Resolves the loaded config's `modelValidate` block into a {@link RuleOptions}
 * suitable for the firebase-model rule pipeline. Returns `undefined` when
 * no override is present (the validator falls back to its defaults).
 *
 * @param config - the parsed `dbx-mcp.config.json`, or `null` when missing
 * @returns the rule overrides, or `undefined` when none are configured
 */
function resolveModelValidateRuleOptions(config: { readonly modelValidate?: { readonly maxFieldNameLength?: number; readonly ignoredFieldNames?: readonly string[] } } | null): RuleOptions | undefined {
  const block = config?.modelValidate;
  if (block === undefined) {
    return undefined;
  }
  const ignoredFieldNames = block.ignoredFieldNames === undefined ? undefined : new Set(block.ignoredFieldNames);
  const result: RuleOptions = {
    maxFieldNameLength: block.maxFieldNameLength,
    ignoredFieldNames
  };
  return result;
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
 * Default observer used when {@link CreateServerOptions.onDbxDocsUiExamplesLoaderResult}
 * is not supplied. Mirrors the other loader-result reporters for the
 * dbx-docs-ui-examples registry.
 *
 * @param result - the loader output to summarise
 */
function reportDbxDocsUiExamplesLoaderResult(result: LoadDbxDocsUiExamplesRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] dbx-docs-ui-examples registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] dbx-docs-ui-examples-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] dbx-docs-ui-examples-loader-warning: ${warning.kind}\n`);
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

/**
 * Default observer used when {@link CreateServerOptions.onTokenLoaderResult}
 * is not supplied. Mirrors the other loader-result reporters for the
 * design-token registry.
 *
 * @param result - the loader output to summarise
 */
function reportTokenLoaderResult(result: LoadTokenRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] tokens registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] tokens-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] tokens-loader-warning: ${warning.kind}\n`);
  }
}

/**
 * Default observer used when {@link CreateServerOptions.onCssUtilityLoaderResult}
 * is not supplied. Mirrors the other loader-result reporters for the
 * css-utility-class registry.
 *
 * @param result - the loader output to summarise
 */
function reportCssUtilityLoaderResult(result: LoadCssUtilityRegistryResult): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] css-utilities registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] css-utilities-config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] css-utilities-loader-warning: ${warning.kind}\n`);
  }
}

const HINT_CLUSTER_LABEL: Record<DownstreamCluster, string> = {
  semanticTypes: 'semantic-types',
  uiComponents: 'ui-components',
  forgeFields: 'forge-fields',
  pipes: 'pipes',
  actions: 'actions',
  filters: 'filters'
};

interface EmitDownstreamHintsInput {
  readonly cwd: string;
  readonly externalCounts: Partial<Record<DownstreamCluster, number>>;
  readonly onDownstreamHints?: (hints: readonly DownstreamHint[]) => void;
}

/**
 * Discovers downstream packages once and emits a per-cluster hint when:
 *   - the loader for that cluster ran (i.e. wasn't bypassed by an injected
 *     registry), AND
 *   - the loader saw zero external sources, AND
 *   - at least one discovered package looks like it provides entries for the
 *     cluster (heuristic + scan-config declarations).
 *
 * Default observer prints a single line per cluster on stderr; tests pass
 * `onDownstreamHints` to capture the structured hints instead.
 *
 * @param input - the cwd, the per-cluster external counts, and an optional observer
 */
async function emitDownstreamHints(input: EmitDownstreamHintsInput): Promise<void> {
  const { cwd, externalCounts, onDownstreamHints } = input;
  let packages: readonly DownstreamPackage[];
  try {
    packages = await discoverDownstreamPackages({ workspaceRoot: cwd });
  } catch {
    packages = [];
  }
  if (packages.length === 0) {
    if (onDownstreamHints !== undefined) onDownstreamHints([]);
    return;
  }

  const hints: DownstreamHint[] = [];
  for (const cluster of DOWNSTREAM_CLUSTERS) {
    const externalCount = externalCounts[cluster];
    if (externalCount === undefined) continue; // loader bypassed (test injected registry)
    if (externalCount > 0) continue; // already registered — no nudge needed
    const candidates = packages.filter((p) => p.candidateClusters.includes(cluster));
    if (candidates.length > 0) hints.push({ cluster, packages: candidates });
  }

  if (onDownstreamHints !== undefined) {
    onDownstreamHints(hints);
    return;
  }
  for (const hint of hints) {
    const dirs = hint.packages.map((p) => p.relDir).join(', ');
    process.stderr.write(`[dbx-components-mcp] ${HINT_CLUSTER_LABEL[hint.cluster]}-hint: ${hint.packages.length} downstream package(s) (${dirs}) appear to define ${HINT_CLUSTER_LABEL[hint.cluster]} entries but none are registered. Run \`dbx_mcp_config op="status"\` for setup instructions.\n`);
  }
}
