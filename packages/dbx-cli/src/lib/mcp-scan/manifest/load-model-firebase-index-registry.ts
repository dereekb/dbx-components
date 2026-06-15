/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadModelFirebaseIndexManifests}, and
 * {@link createModelFirebaseIndexRegistry}.
 *
 * Resolves the bundled `@dereekb/firebase` model-firebase-index manifest
 * that ships inside this package's `generated/` directory and merges it
 * with any external sources declared in `dbx-mcp.config.json` under
 * `modelFirebaseIndex.sources`. The resulting
 * {@link ModelFirebaseIndexRegistry} is the data the
 * `dbx_model_firebase_index_*` tools read from.
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
import { createModelFirebaseIndexRegistry, EMPTY_MODEL_FIREBASE_INDEX_REGISTRY, type ModelFirebaseIndexRegistry } from '@dereekb/dbx-cli/firestore-indexes';
import { loadModelFirebaseIndexManifests, type ModelFirebaseIndexLoaderWarning, type ModelFirebaseIndexManifestReadFile, type ModelFirebaseIndexManifestSource } from './model-firebase-index-loader.js';

// MARK: Public types
/**
 * Function shape used by {@link loadModelFirebaseIndexRegistry} to
 * enumerate the bundled `@dereekb/firebase` manifest path shipped with
 * this package. Defaults to the JSON file inside the package's
 * `generated/` directory.
 */
export type BundledModelFirebaseIndexManifestPathsFactory = () => readonly string[];

/**
 * Input to {@link loadModelFirebaseIndexRegistry}.
 */
export interface LoadModelFirebaseIndexRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledModelFirebaseIndexManifestPathsFactory;
  readonly readFile?: ModelFirebaseIndexManifestReadFile;
}

/**
 * Outcome from {@link loadModelFirebaseIndexRegistry}.
 */
export interface LoadModelFirebaseIndexRegistryResult {
  readonly registry: ModelFirebaseIndexRegistry;
  readonly configPath: Maybe<string>;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly ModelFirebaseIndexLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-firebase.model-firebase-index.mcp.generated.json'] as const;

const DEFAULT_BUNDLED_PATHS: BundledModelFirebaseIndexManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged model-firebase-index registry for the current MCP server.
 *
 * @param input - Cwd plus optional injected bundled-path factory and reader.
 * @returns The registry, the resolved config path (if any), and any warnings.
 */
export async function loadModelFirebaseIndexRegistry(input: LoadModelFirebaseIndexRegistryInput): Promise<LoadModelFirebaseIndexRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: ModelFirebaseIndexManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path, strict: false }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: ModelFirebaseIndexManifestSource[] = [];
  if (configResult.config != null && configResult.configPath != null) {
    const baseDir = dirname(configResult.configPath);
    const declared = configResult.config.modelFirebaseIndex?.sources ?? [];
    for (const source of declared) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }

  let registry: ModelFirebaseIndexRegistry = EMPTY_MODEL_FIREBASE_INDEX_REGISTRY;
  let loaderWarnings: readonly ModelFirebaseIndexLoaderWarning[] = [];

  const sources: readonly ModelFirebaseIndexManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    try {
      const loaded = await loadModelFirebaseIndexManifests({ sources, readFile });
      registry = createModelFirebaseIndexRegistry(loaded);
      loaderWarnings = loaded.warnings;
    } catch {
      registry = EMPTY_MODEL_FIREBASE_INDEX_REGISTRY;
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
 * Re-exported so callers can build a deterministic test fixture pointing
 * at the package's bundled manifests without touching `import.meta.url`.
 *
 * @returns The absolute paths of the bundled `@dereekb/firebase` manifests.
 */
export function getDefaultBundledModelFirebaseIndexManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
