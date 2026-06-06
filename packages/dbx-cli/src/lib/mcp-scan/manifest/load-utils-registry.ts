/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadUtilManifests}, and {@link createUtilRegistry}.
 *
 * Resolves the bundled `@dereekb/*` utils manifests that ship inside this
 * package's `generated/` directory and merges them with any external
 * sources declared in `dbx-mcp.config.json` under `utils.sources`. The
 * resulting {@link UtilRegistry} is the data the `dbx_util_lookup` and
 * `dbx_util_search` tools read from.
 *
 * All I/O is injectable so unit tests can drive every branch without
 * touching disk. The default `bundledManifestPaths` factory uses
 * `import.meta.url` to locate the package's `generated/` directory
 * regardless of whether the caller imports the source or the bundled
 * binary.
 */

import type { Maybe } from '@dereekb/util';
import { dirname, isAbsolute, resolve } from 'node:path';
import { findPackageRoot } from './package-root.js';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createUtilRegistry, EMPTY_UTIL_REGISTRY, type UtilRegistry } from '../registry/utils-runtime.js';
import { loadUtilManifests, type UtilLoaderWarning, type UtilManifestReadFile, type UtilManifestSource } from './utils-loader.js';

// MARK: Public types
/**
 * Function shape used by {@link loadUtilRegistry} to enumerate the bundled
 * `@dereekb/*` manifest paths shipped with this package. Defaults to the
 * JSON files inside the package's `generated/` directory.
 */
export type BundledUtilManifestPathsFactory = () => readonly string[];

/**
 * Input to {@link loadUtilRegistry}.
 */
export interface LoadUtilRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledUtilManifestPathsFactory;
  readonly readFile?: UtilManifestReadFile;
}

/**
 * Outcome from {@link loadUtilRegistry}. Surfaces both the registry and
 * the loader warnings so callers (the server bootstrap) can log anything
 * that fell through warn-and-skip.
 */
export interface LoadUtilRegistryResult {
  readonly registry: UtilRegistry;
  readonly configPath: Maybe<string>;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly UtilLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-util.utils.mcp.generated.json', 'dereekb-date.utils.mcp.generated.json', 'dereekb-rxjs.utils.mcp.generated.json', 'dereekb-model.utils.mcp.generated.json'] as const;

const DEFAULT_BUNDLED_PATHS: BundledUtilManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged utils registry for the current MCP server.
 *
 * Bundled `@dereekb/*` manifests load as non-strict sources because not
 * every package may have @dbxUtil-tagged exports yet — a missing bundled
 * file should warn and skip rather than fail server startup. External
 * manifests declared in `dbx-mcp.config.json` likewise load as non-strict
 * sources so a single bad downstream manifest does not take the registry
 * down.
 *
 * Returns an {@link EMPTY_UTIL_REGISTRY} with surfaced warnings when
 * neither bundled nor external manifests yield any successful load — the
 * loader's "zero successful manifests" guard is caught and translated
 * into an empty registry so a workspace that hasn't run
 * `generate-manifests` yet still boots.
 *
 * @param input - Cwd plus optional injected bundled-path factory and reader.
 * @returns The registry, the resolved config path (if any), and any warnings.
 */
export async function loadUtilRegistry(input: LoadUtilRegistryInput): Promise<LoadUtilRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: UtilManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path, strict: false }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: UtilManifestSource[] = [];
  if (configResult.config != null && configResult.configPath != null) {
    const baseDir = dirname(configResult.configPath);
    const declared = configResult.config.utils?.sources ?? [];
    for (const source of declared) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }

  let registry: UtilRegistry = EMPTY_UTIL_REGISTRY;
  let loaderWarnings: readonly UtilLoaderWarning[] = [];

  const sources: readonly UtilManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    try {
      const loaded = await loadUtilManifests({ sources, readFile });
      registry = createUtilRegistry(loaded);
      loaderWarnings = loaded.warnings;
    } catch {
      // "zero manifests loaded successfully" — keep an empty registry so
      // a workspace that hasn't run `generate-manifests` yet still boots.
      registry = EMPTY_UTIL_REGISTRY;
    }
  }

  const result: LoadUtilRegistryResult = {
    registry,
    configPath: configResult.configPath,
    configWarnings: configResult.warnings,
    loaderWarnings,
    externalSourceCount: externalSources.length
  };
  return result;
}

/**
 * Re-exported so callers can build a deterministic test fixture pointing
 * at the package's bundled manifests without touching `import.meta.url`.
 *
 * @returns The absolute paths of the bundled `@dereekb/*` manifests.
 */
export function getDefaultBundledUtilManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
