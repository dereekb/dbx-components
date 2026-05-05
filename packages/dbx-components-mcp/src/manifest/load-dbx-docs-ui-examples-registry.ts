/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadDbxDocsUiExamplesManifests}, and
 * {@link createDbxDocsUiExamplesRegistry}.
 *
 * Resolves the bundled `apps/demo` dbx-docs-ui-examples manifest plus any
 * external sources declared in `dbx-mcp.config.json` under
 * `dbxDocsUiExamples.sources`. Mirrors `load-ui-components-registry.ts`.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createDbxDocsUiExamplesRegistry, EMPTY_DBX_DOCS_UI_EXAMPLES_REGISTRY, type DbxDocsUiExamplesRegistry } from '../registry/dbx-docs-ui-examples-runtime.js';
import { loadDbxDocsUiExamplesManifests, type DbxDocsUiExamplesLoaderWarning, type DbxDocsUiExamplesManifestReadFile, type DbxDocsUiExamplesManifestSource } from './dbx-docs-ui-examples-loader.js';

// MARK: Public types
export type BundledDbxDocsUiExamplesManifestPathsFactory = () => readonly string[];

export interface LoadDbxDocsUiExamplesRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledDbxDocsUiExamplesManifestPathsFactory;
  readonly readFile?: DbxDocsUiExamplesManifestReadFile;
}

export interface LoadDbxDocsUiExamplesRegistryResult {
  readonly registry: DbxDocsUiExamplesRegistry;
  readonly configPath: string | null;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly DbxDocsUiExamplesLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-demo.dbx-docs-ui-examples.mcp.generated.json'] as const;

function findPackageRoot(startUrl: string): string {
  const startPath = fileURLToPath(startUrl);
  let dir = dirname(startPath);
  while (true) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findPackageRoot: no package.json found above ${startPath}`);
    }
    dir = parent;
  }
}

const DEFAULT_BUNDLED_PATHS: BundledDbxDocsUiExamplesManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged dbx-docs-ui-examples registry for the current MCP server.
 *
 * Bundled manifests load as strict sources; external manifests declared in
 * `dbx-mcp.config.json` load as non-strict sources.
 *
 * @param input - Resolution context.
 * @param input.cwd - Working directory used to locate `dbx-mcp.config.json`.
 * @param input.bundledManifestPaths - Optional override for the bundled manifest path factory; defaults to the manifests shipped with this package.
 * @param input.readFile - Optional file reader used during testing.
 * @returns The composed registry, the resolved config path (if any), config and loader warnings, and the count of external sources.
 */
export async function loadDbxDocsUiExamplesRegistry(input: LoadDbxDocsUiExamplesRegistryInput): Promise<LoadDbxDocsUiExamplesRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: DbxDocsUiExamplesManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: DbxDocsUiExamplesManifestSource[] = [];
  if (configResult.config !== null && configResult.configPath !== null) {
    const baseDir = dirname(configResult.configPath);
    const declared = configResult.config.dbxDocsUiExamples?.sources ?? [];
    for (const source of declared) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }

  let registry: DbxDocsUiExamplesRegistry = EMPTY_DBX_DOCS_UI_EXAMPLES_REGISTRY;
  let loaderWarnings: readonly DbxDocsUiExamplesLoaderWarning[] = [];

  const sources: readonly DbxDocsUiExamplesManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    try {
      const loaded = await loadDbxDocsUiExamplesManifests({ sources, readFile });
      registry = createDbxDocsUiExamplesRegistry(loaded);
      loaderWarnings = loaded.warnings;
    } catch {
      // If the bundled manifest is missing or invalid, fall back to the
      // empty registry rather than crashing the entire server. This
      // tolerates the bootstrap window before regeneration has run for
      // the first time.
      registry = EMPTY_DBX_DOCS_UI_EXAMPLES_REGISTRY;
    }
  }

  return {
    registry,
    configPath: configResult.configPath,
    configWarnings: configResult.warnings,
    loaderWarnings,
    externalSourceCount: externalSources.length
  };
}

/**
 * Resolves the absolute paths of the bundled dbx-docs-ui-examples manifests shipped with this package.
 *
 * @returns Absolute filesystem paths of the bundled manifests.
 */
export function getDefaultBundledDbxDocsUiExamplesManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
