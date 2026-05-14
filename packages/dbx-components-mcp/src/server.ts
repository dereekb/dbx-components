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
import { loadUtilRegistry, type LoadUtilRegistryResult } from './manifest/load-utils-registry.js';
import { loadModelSnapshotFieldRegistry, type LoadModelSnapshotFieldRegistryResult } from './manifest/load-model-snapshot-fields-registry.js';
import { loadSemanticTypeRegistry, type LoadSemanticTypeRegistryResult } from './manifest/load-registry.js';
import { loadTokenRegistry, type LoadTokenRegistryResult } from './manifest/load-tokens-registry.js';
import { loadCssUtilityRegistry, type LoadCssUtilityRegistryResult } from './manifest/load-css-utilities-registry.js';
import { loadUiComponentRegistry, type LoadUiComponentRegistryResult } from './manifest/load-ui-components-registry.js';
import { loadDbxDocsUiExamplesRegistry, type LoadDbxDocsUiExamplesRegistryResult } from './manifest/load-dbx-docs-ui-examples-registry.js';
import type { ActionRegistry } from './registry/actions-runtime.js';
import type { FilterRegistry } from './registry/filters-runtime.js';
import type { ForgeFieldRegistry } from './registry/forge-fields.js';
import type { PipeRegistry } from './registry/pipes-runtime.js';
import type { UtilRegistry } from './registry/utils-runtime.js';
import type { ModelSnapshotFieldRegistry } from './registry/model-snapshot-fields-runtime.js';
import type { SemanticTypeRegistry } from './registry/semantic-types.js';
import type { TokenRegistry } from './registry/tokens-runtime.js';
import type { CssUtilityRegistry } from './registry/css-utilities-runtime.js';
import type { UiComponentRegistry } from './registry/ui-components-runtime.js';
import type { DbxDocsUiExamplesRegistry } from './registry/dbx-docs-ui-examples-runtime.js';
import { FIREBASE_MODELS } from './registry/firebase-models.js';
import type { AuthRegistry } from './registry/auth-runtime.js';
import { loadAuthRegistry, type LoadAuthRegistryResult } from './manifest/load-auth-registry.js';
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
- util         — utility functions/classes/factories/constants opted in via @dbxUtil JSDoc tags (search by intent: "expiration", "throttle", "memoize")
- model_snapshot_field — Firestore snapshot-field factories + reusable consts (firestoreString, firestoreDate, firestoreObjectArray, …) tagged with @dbxModelSnapshotField; lookup/search by intent ("date", "encoded array"), plus list_app to see which fields a downstream component+app actually uses
- semantic_type — semantic type aliases (string/number aliases) lookup and search
- artifact     — body templates for storagefile-purpose, notification-template, notification-task; file-convention reporting
- asset        — \`AssetPathRef\` constants in a \`-firebase\` component + \`provideDbxAssetLoader()\` wiring in the Angular app; list/scaffold/validate
- color        — \`DbxColorConfigTemplate\` registry: list registered templates in an Angular app, smell-check duplicate inline \`DbxColorConfig\` literals that should be templates
- auth         — Firebase Auth claims/roles/OIDC scopes catalog: claim_lookup (key or \`*ApiAuthClaims\` interface), scope_lookup (\`model.read\`, …), role_lookup (forward / by-tag / reverse), token_explain (decode JWT or claims object), list_app (per-app surface)

Model-extension validators (walk a downstream app to verify wiring):
- storagefile_m, notification_m, system_m — *_validate_app, *_list_app, *_validate_folder
- asset — *_validate_app, *_list_app, *_validate_folder, *_scaffold (component-side \`assets.ts\` + Angular front-end wiring)
- model_fixture — list/lookup/validate/scaffold/forward an app's \`src/test/fixture.ts\` (TestContextFixture/Instance triplets)

Resource URIs are namespaced by domain:
- dbx://form/fields[/{slug}|/produces/{produces}|/tier/{tier}|/array-output/{arrayOutput}]
- dbx://model/firebase[/{name}|/prefix/{prefix}|/subcollections/{parent}|/user-keyed-by-id|/user-related]
- dbx://action/entries[/{slug}|/role/{role}]
- dbx://ui/components[/{slug}|/category/{category}|/kind/{kind}]
- dbx://pipe/entries[/{slug}|/category/{category}]
- dbx://util/entries[/{slug}|/category/{category}|/module/{module}|/tag/{tag}]
- dbx://model-snapshot-field/entries[/{slug}|/category/{category}|/module/{module}|/tag/{tag}]
- dbx://filter/entries[/{slug}|/kind/{kind}]
- dbx://token/entries[/{cssVariable}|/source/{source}|/role/{role}]
- dbx://css-utility/entries[/{slug}|/role/{role}|/source/{source}]
- dbx://auth/{catalog | claim/{key} | role/{role} | role/tag/{tag} | scope/{scope} | app/{app}}

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
  readonly utilRegistry?: UtilRegistry;
  readonly modelSnapshotFieldRegistry?: ModelSnapshotFieldRegistry;
  readonly actionRegistry?: ActionRegistry;
  readonly filterRegistry?: FilterRegistry;
  readonly tokenRegistry?: TokenRegistry;
  readonly cssUtilityRegistry?: CssUtilityRegistry;
  /**
   * Optional pre-built auth registry. When omitted the server scans the
   * workspace for downstream `claims.ts` files tagged with
   * `@dbxAuthClaimsApp`, runs the auth extractor, and merges the
   * resulting entries with the bundled built-ins (`@dereekb/util` roles,
   * `fr` claim, `model.*` scopes).
   */
  readonly authRegistry?: AuthRegistry;
  /**
   * Optional observer for the auth registry loader result. When omitted,
   * the loader writes a one-line summary plus per-warning lines to stderr.
   */
  readonly onAuthLoaderResult?: (result: LoadAuthRegistryResult) => void;
  readonly onLoaderResult?: (result: LoadSemanticTypeRegistryResult) => void;
  readonly onUiLoaderResult?: (result: LoadUiComponentRegistryResult) => void;
  readonly onDbxDocsUiExamplesLoaderResult?: (result: LoadDbxDocsUiExamplesRegistryResult) => void;
  readonly onForgeLoaderResult?: (result: LoadForgeFieldRegistryResult) => void;
  readonly onPipeLoaderResult?: (result: LoadPipeRegistryResult) => void;
  readonly onUtilLoaderResult?: (result: LoadUtilRegistryResult) => void;
  readonly onModelSnapshotFieldLoaderResult?: (result: LoadModelSnapshotFieldRegistryResult) => void;
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
  const cwd = options.cwd ?? process.cwd();

  const configResult = await findAndLoadConfig({ cwd });
  for (const warning of configResult.warnings) {
    process.stderr.write(`[dbx-components-mcp] config-warning: ${warning.kind} ${warning.path}\n`);
  }
  const modelValidateRuleOptions = resolveModelValidateRuleOptions(configResult.config);

  const registry = await resolveOptionalRegistry({
    injected: options.semanticTypeRegistry,
    cwd,
    load: loadSemanticTypeRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('semantic-types', '', r),
    failureLabel: 'semantic-types',
    catchErrors: false,
    onSuccess: (r) => {
      externalCounts.semanticTypes = r.externalSourceCount;
    }
  });

  const uiRegistry = await resolveOptionalRegistry({
    injected: options.uiComponentRegistry,
    cwd,
    load: loadUiComponentRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onUiLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('ui-components', 'ui-', r),
    failureLabel: 'ui-components',
    catchErrors: true,
    onSuccess: (r) => {
      externalCounts.uiComponents = r.externalSourceCount;
    }
  });

  const dbxDocsUiExamplesRegistry = await resolveOptionalRegistry({
    injected: options.dbxDocsUiExamplesRegistry,
    cwd,
    load: loadDbxDocsUiExamplesRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onDbxDocsUiExamplesLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('dbx-docs-ui-examples', 'dbx-docs-ui-examples-', r),
    failureLabel: 'dbx-docs-ui-examples',
    catchErrors: true
  });

  const forgeRegistry = await resolveOptionalRegistry({
    injected: options.forgeFieldRegistry,
    cwd,
    load: loadForgeFieldRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onForgeLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('forge-fields', 'forge-', r),
    failureLabel: 'forge-fields',
    catchErrors: true,
    onSuccess: (r) => {
      externalCounts.forgeFields = r.externalSourceCount;
    }
  });

  const pipeRegistry = await resolveOptionalRegistry({
    injected: options.pipeRegistry,
    cwd,
    load: loadPipeRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onPipeLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('pipes', 'pipes-', r),
    failureLabel: 'pipes',
    catchErrors: true,
    onSuccess: (r) => {
      externalCounts.pipes = r.externalSourceCount;
    }
  });

  const utilRegistry = await resolveOptionalRegistry({
    injected: options.utilRegistry,
    cwd,
    load: loadUtilRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onUtilLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('utils', 'utils-', r),
    failureLabel: 'utils',
    catchErrors: true
  });

  const modelSnapshotFieldRegistry = await resolveOptionalRegistry({
    injected: options.modelSnapshotFieldRegistry,
    cwd,
    load: loadModelSnapshotFieldRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onModelSnapshotFieldLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('model-snapshot-fields', 'model-snapshot-fields-', r),
    failureLabel: 'model-snapshot-fields',
    catchErrors: true
  });

  const actionRegistry = await resolveOptionalRegistry({
    injected: options.actionRegistry,
    cwd,
    load: loadActionRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onActionLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('actions', 'actions-', r),
    failureLabel: 'actions',
    catchErrors: true,
    onSuccess: (r) => {
      externalCounts.actions = r.externalSourceCount;
    }
  });

  const filterRegistry = await resolveOptionalRegistry({
    injected: options.filterRegistry,
    cwd,
    load: loadFilterRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onFilterLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('filters', 'filters-', r),
    failureLabel: 'filters',
    catchErrors: true,
    onSuccess: (r) => {
      externalCounts.filters = r.externalSourceCount;
    }
  });

  const tokenRegistry = await resolveOptionalRegistry({
    injected: options.tokenRegistry,
    cwd,
    load: loadTokenRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onTokenLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('tokens', 'tokens-', r),
    failureLabel: 'tokens',
    catchErrors: true
  });

  const cssUtilityRegistry = await resolveOptionalRegistry({
    injected: options.cssUtilityRegistry,
    cwd,
    load: loadCssUtilityRegistry,
    extractRegistry: (r) => r.registry,
    observer: options.onCssUtilityLoaderResult,
    defaultReport: (r) => reportRegistryLoaderResult('css-utilities', 'css-utilities-', r),
    failureLabel: 'css-utilities',
    catchErrors: true
  });

  const fixtureModelRegistry: FixtureModelRegistry = {
    entries: FIREBASE_MODELS.map((m) => ({ name: m.name, modelType: m.modelType, collectionPrefix: m.collectionPrefix }))
  };

  const authRegistry = await resolveAuthRegistry({ injected: options.authRegistry, cwd, onAuthLoaderResult: options.onAuthLoaderResult });

  await emitDownstreamHints({ cwd, externalCounts, onDownstreamHints: options.onDownstreamHints });

  registerResources(server, { semanticTypeRegistry: registry, forgeFieldRegistry: forgeRegistry, pipeRegistry, utilRegistry, modelSnapshotFieldRegistry, uiComponentRegistry: uiRegistry, actionRegistry, filterRegistry, tokenRegistry, cssUtilityRegistry, authRegistry });
  registerTools(server, { semanticTypeRegistry: registry, forgeFieldRegistry: forgeRegistry, pipeRegistry, utilRegistry, modelSnapshotFieldRegistry, uiComponentRegistry: uiRegistry, dbxDocsUiExamplesRegistry, actionRegistry, filterRegistry, tokenRegistry, cssUtilityRegistry, fixtureModelRegistry, modelValidateRuleOptions, authRegistry, cwd });

  return server;
}

interface ResolveOptionalRegistryArgs<TRegistry, TResult> {
  readonly injected: TRegistry | undefined;
  readonly cwd: string;
  readonly load: (input: { cwd: string }) => Promise<TResult>;
  readonly extractRegistry: (result: TResult) => TRegistry;
  readonly observer: ((result: TResult) => void) | undefined;
  readonly defaultReport: (result: TResult) => void;
  readonly failureLabel: string;
  readonly catchErrors: boolean;
  readonly onSuccess?: (result: TResult) => void;
}

/**
 * Resolves an optional per-cluster registry. Returns the injected value when
 * provided; otherwise runs the loader, forwards the result to the supplied
 * observer (or the default reporter), and returns the extracted registry.
 * Catches and logs loader failures when `catchErrors` is set so non-critical
 * registries don't abort server startup.
 *
 * @param args - injected registry / loader / observer plus failure policy
 * @returns the resolved registry, or `undefined` when not injected and the
 *   loader failed under `catchErrors: true`.
 */
async function resolveOptionalRegistry<TRegistry, TResult>(args: ResolveOptionalRegistryArgs<TRegistry, TResult>): Promise<TRegistry | undefined> {
  if (args.injected !== undefined) return args.injected;
  try {
    const result = await args.load({ cwd: args.cwd });
    if (args.observer === undefined) {
      args.defaultReport(result);
    } else {
      args.observer(result);
    }
    args.onSuccess?.(result);
    return args.extractRegistry(result);
  } catch (error) {
    if (!args.catchErrors) throw error;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[dbx-components-mcp] ${args.failureLabel} registry unavailable: ${message}\n`);
    return undefined;
  }
}

/**
 * Resolves the loaded config's `modelValidate` block into a {@link RuleOptions}
 * suitable for the firebase-model rule pipeline. Returns `undefined` when
 * no override is present (the validator falls back to its defaults).
 *
 * @param config - the parsed `dbx-mcp.config.json`, or `null` when missing
 * @returns the rule overrides, or `undefined` when none are configured
 */
function resolveModelValidateRuleOptions(config: { readonly modelValidate?: { readonly maxFieldNameLength?: number; readonly ignoredFieldNames?: readonly string[]; readonly ignoredExternalParents?: readonly string[] } } | null): RuleOptions | undefined {
  const block = config?.modelValidate;
  if (block === undefined) {
    return undefined;
  }
  const ignoredFieldNames = block.ignoredFieldNames === undefined ? undefined : new Set(block.ignoredFieldNames);
  const ignoredExternalParents = block.ignoredExternalParents === undefined ? undefined : new Set(block.ignoredExternalParents);
  const result: RuleOptions = {
    maxFieldNameLength: block.maxFieldNameLength,
    ignoredFieldNames,
    ignoredExternalParents
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
 * Minimum shape every `Load*RegistryResult` exposes that the default observer
 * needs. Lets {@link reportRegistryLoaderResult} accept any per-cluster result
 * structurally without a generic per-registry type parameter.
 */
interface RegistryLoaderResultLike {
  readonly registry: { readonly loadedSources: readonly string[]; readonly all: readonly unknown[] };
  readonly configPath: string | null;
  readonly configWarnings: readonly { readonly kind: string; readonly path: string }[];
  readonly loaderWarnings: readonly { readonly kind: string }[];
  readonly externalSourceCount: number;
}

/**
 * Default observer used when a per-cluster `on*LoaderResult` option is not
 * supplied. Emits a single info line on stderr summarising which sources
 * loaded and how many warnings were collected, plus one line per warning so
 * operators can spot misconfiguration without paging through stdio frames.
 *
 * @param label - registry display label (e.g. `semantic-types`, `ui-components`)
 * @param warningPrefix - prefix prepended to `config-warning`/`loader-warning`
 *   tags so operators can tell which loader emitted each line. Empty for the
 *   semantic-types loader (historical baseline); short identifier (`ui-`,
 *   `forge-`, …) for the others.
 * @param result - the loader output to summarise
 */
function reportRegistryLoaderResult(label: string, warningPrefix: string, result: RegistryLoaderResultLike): void {
  const { registry, configPath, configWarnings, loaderWarnings, externalSourceCount } = result;
  const summary = [`[dbx-components-mcp] ${label} registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  external: ${externalSourceCount}`, `  config: ${configPath ?? '(none)'}`, `  entries: ${registry.all.length}`, `  warnings: ${configWarnings.length + loaderWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of configWarnings) {
    process.stderr.write(`[dbx-components-mcp] ${warningPrefix}config-warning: ${warning.kind} ${warning.path}\n`);
  }
  for (const warning of loaderWarnings) {
    process.stderr.write(`[dbx-components-mcp] ${warningPrefix}loader-warning: ${warning.kind}\n`);
  }
}

interface ResolveAuthRegistryInput {
  readonly injected: AuthRegistry | undefined;
  readonly cwd: string;
  readonly onAuthLoaderResult?: (result: LoadAuthRegistryResult) => void;
}

/**
 * Resolves the auth registry the server should advertise. Returns the
 * pre-built registry from `options.authRegistry` when present (test path);
 * otherwise runs {@link loadAuthRegistry} against the workspace cwd and
 * forwards the result to the supplied observer (or the default stderr
 * reporter when none is provided).
 *
 * @param input - injected registry plus loader cwd / observer
 * @returns the resolved auth registry
 */
async function resolveAuthRegistry(input: ResolveAuthRegistryInput): Promise<AuthRegistry> {
  const { injected, cwd, onAuthLoaderResult } = input;
  if (injected !== undefined) return injected;
  const authLoaderResult = await loadAuthRegistry({ cwd });
  if (onAuthLoaderResult === undefined) {
    reportAuthLoaderResult(authLoaderResult);
  } else {
    onAuthLoaderResult(authLoaderResult);
  }
  return authLoaderResult.registry;
}

/**
 * Default observer for the auth loader. Mirrors {@link reportRegistryLoaderResult}
 * but tailored to the auth result's shape (file warnings + extract warnings
 * instead of config-warning / loader-warning lists). Emits one summary line plus
 * one line per warning so operators can spot misconfigured downstream
 * `claims.ts` files.
 *
 * @param result - the auth loader result to summarise
 */
function reportAuthLoaderResult(result: LoadAuthRegistryResult): void {
  const { registry, scannedFiles, fileWarnings, extractWarnings, extractedAppCount, extractedClaimCount } = result;
  const summary = [`[dbx-components-mcp] auth registry loaded`, `  sources: ${registry.loadedSources.join(', ') || '(none)'}`, `  scanned-files: ${scannedFiles.length}`, `  apps: ${registry.apps.length} (extracted: ${extractedAppCount})`, `  claims: ${registry.claims.length} (extracted: ${extractedClaimCount})`, `  warnings: ${fileWarnings.length + extractWarnings.length}`].join('\n');
  process.stderr.write(`${summary}\n`);
  for (const warning of fileWarnings) {
    process.stderr.write(`[dbx-components-mcp] auth-file-warning: ${warning.kind} ${warning.relPath} ${warning.error}\n`);
  }
  for (const warning of extractWarnings) {
    process.stderr.write(`[dbx-components-mcp] auth-extract-warning: ${warning.kind} ${formatAuthExtractWarning(warning)}\n`);
  }
}

function formatAuthExtractWarning(warning: { readonly kind: string; readonly filePath?: string; readonly line?: number } & Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(warning)) {
    if (key === 'kind') continue;
    if (value === undefined) continue;
    parts.push(`${key}=${formatWarningValue(value)}`);
  }
  return parts.join(' ');
}

function formatWarningValue(value: unknown): string {
  let result: string;
  if (typeof value === 'string') {
    result = value;
  } else if (value === null || value === undefined) {
    result = String(value);
  } else if (typeof value === 'object') {
    result = JSON.stringify(value);
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    result = value.toString();
  } else {
    result = JSON.stringify(value);
  }
  return result;
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
