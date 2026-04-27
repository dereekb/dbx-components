/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadFilterManifests}, and {@link createFilterRegistry}.
 *
 * Resolves the bundled `@dereekb/*` filter manifests that ship inside this
 * package's `generated/` directory and merges them with any external sources
 * declared in `dbx-mcp.config.json` under `filters.sources`. The resulting
 * {@link FilterRegistry} is the data the `dbx_filter_lookup` tool reads from.
 *
 * All I/O is injectable so unit tests can drive every branch without
 * touching disk. The default `bundledManifestPaths` factory uses
 * `import.meta.url` to locate the package's `generated/` directory
 * regardless of whether the caller imports the source or the bundled binary.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createFilterRegistry, EMPTY_FILTER_REGISTRY, type FilterRegistry } from '../registry/filters-runtime.js';
import { loadFilterManifests, type FilterLoaderWarning, type FilterManifestReadFile, type FilterManifestSource } from './filters-loader.js';

// MARK: Public types
/**
 * Function shape used by {@link loadFilterRegistry} to enumerate the bundled
 * `@dereekb/*` manifest paths shipped with this package. Defaults to the
 * JSON files inside the package's `generated/` directory.
 */
export type BundledFilterManifestPathsFactory = () => readonly string[];

/**
 * Input to {@link loadFilterRegistry}.
 */
export interface LoadFilterRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledFilterManifestPathsFactory;
  readonly readFile?: FilterManifestReadFile;
}

/**
 * Outcome from {@link loadFilterRegistry}. Surfaces both the registry and the
 * loader warnings so callers (the server bootstrap) can log anything that
 * fell through warn-and-skip.
 */
export interface LoadFilterRegistryResult {
  readonly registry: FilterRegistry;
  readonly configPath: string | null;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly FilterLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-dbx-core.filters.mcp.generated.json'] as const;

function findPackageRoot(startUrl: string): string {
  const startPath = fileURLToPath(startUrl);
  let dir = dirname(startPath);
  let result: string | undefined;
  while (result === undefined) {
    if (existsSync(resolve(dir, 'package.json'))) {
      result = dir;
    } else {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`findPackageRoot: no package.json found above ${startPath}`);
      }
      dir = parent;
    }
  }
  return result;
}

const DEFAULT_BUNDLED_PATHS: BundledFilterManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged filter registry for the current MCP server.
 *
 * Bundled `@dereekb/*` manifests load as strict sources — a malformed or
 * missing bundled file is a build-time bug, not a configuration problem.
 * External manifests declared in `dbx-mcp.config.json` load as non-strict
 * sources so a single bad downstream manifest does not take the registry
 * down.
 *
 * Returns an {@link EMPTY_FILTER_REGISTRY} with surfaced warnings when neither
 * bundled nor external manifests yield any successful load — the loader's
 * "zero successful manifests" guard. The caller is responsible for deciding
 * whether an empty registry is a fatal startup error.
 *
 * @param input - cwd plus optional injected bundled-path factory and reader
 * @returns the registry, the resolved config path (if any), and any warnings
 */
export async function loadFilterRegistry(input: LoadFilterRegistryInput): Promise<LoadFilterRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: FilterManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: FilterManifestSource[] = [];
  if (configResult.config !== null && configResult.configPath !== null) {
    const baseDir = dirname(configResult.configPath);
    const declared = configResult.config.filters?.sources ?? [];
    for (const source of declared) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }

  let registry: FilterRegistry = EMPTY_FILTER_REGISTRY;
  let loaderWarnings: readonly FilterLoaderWarning[] = [];

  const sources: readonly FilterManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    const loaded = await loadFilterManifests({ sources, readFile });
    registry = createFilterRegistry(loaded);
    loaderWarnings = loaded.warnings;
  }

  const result: LoadFilterRegistryResult = {
    registry,
    configPath: configResult.configPath,
    configWarnings: configResult.warnings,
    loaderWarnings,
    externalSourceCount: externalSources.length
  };
  return result;
}

/**
 * Re-exported so callers can build a deterministic test fixture pointing at
 * the package's bundled manifests without touching `import.meta.url`.
 *
 * @returns the absolute paths of the bundled `@dereekb/*` manifests
 */
export function getDefaultBundledFilterManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
