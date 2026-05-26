/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadModelSnapshotFieldManifests}, and
 * {@link createModelSnapshotFieldRegistry}.
 *
 * Resolves the bundled `@dereekb/firebase` model-snapshot-fields manifest that
 * ships inside this package's `generated/` directory and merges it with any
 * external sources declared in `dbx-mcp.config.json` under
 * `modelSnapshotFields.sources`. The resulting
 * {@link ModelSnapshotFieldRegistry} is the data the
 * `dbx_model_snapshot_field_*` tools read from.
 *
 * All I/O is injectable so unit tests can drive every branch without
 * touching disk. The default `bundledManifestPaths` factory uses
 * `import.meta.url` to locate the package's `generated/` directory
 * regardless of whether the caller imports the source or the bundled
 * binary.
 */

import type { Maybe } from '@dereekb/util';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createModelSnapshotFieldRegistry, EMPTY_MODEL_SNAPSHOT_FIELD_REGISTRY, type ModelSnapshotFieldRegistry } from '../registry/model-snapshot-fields-runtime.js';
import { loadModelSnapshotFieldManifests, type ModelSnapshotFieldLoaderWarning, type ModelSnapshotFieldManifestReadFile, type ModelSnapshotFieldManifestSource } from './model-snapshot-fields-loader.js';

// MARK: Public types
/**
 * Function shape used by {@link loadModelSnapshotFieldRegistry} to enumerate
 * the bundled `@dereekb/firebase` manifest path shipped with this package.
 * Defaults to the JSON file inside the package's `generated/` directory.
 */
export type BundledModelSnapshotFieldManifestPathsFactory = () => readonly string[];

/**
 * Input to {@link loadModelSnapshotFieldRegistry}.
 */
export interface LoadModelSnapshotFieldRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledModelSnapshotFieldManifestPathsFactory;
  readonly readFile?: ModelSnapshotFieldManifestReadFile;
}

/**
 * Outcome from {@link loadModelSnapshotFieldRegistry}. Surfaces both the
 * registry and the loader warnings so callers (the server bootstrap) can
 * log anything that fell through warn-and-skip.
 */
export interface LoadModelSnapshotFieldRegistryResult {
  readonly registry: ModelSnapshotFieldRegistry;
  readonly configPath: Maybe<string>;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly ModelSnapshotFieldLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-firebase.model-snapshot-fields.mcp.generated.json'] as const;

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

const DEFAULT_BUNDLED_PATHS: BundledModelSnapshotFieldManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged model-snapshot-fields registry for the current MCP server.
 *
 * Bundled manifests load as non-strict sources because the `@dereekb/firebase`
 * scan may not have produced a manifest yet (e.g. before the first
 * `generate-manifests` run). External manifests declared in
 * `dbx-mcp.config.json` likewise load as non-strict sources so a single bad
 * downstream manifest does not take the registry down.
 *
 * Returns an {@link EMPTY_MODEL_SNAPSHOT_FIELD_REGISTRY} with surfaced
 * warnings when neither bundled nor external manifests yield any successful
 * load — the loader's "zero successful manifests" guard is caught and
 * translated into an empty registry so a workspace that hasn't run
 * `generate-manifests` yet still boots.
 *
 * @param input - Cwd plus optional injected bundled-path factory and reader.
 * @returns The registry, the resolved config path (if any), and any warnings.
 */
export async function loadModelSnapshotFieldRegistry(input: LoadModelSnapshotFieldRegistryInput): Promise<LoadModelSnapshotFieldRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: ModelSnapshotFieldManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path, strict: false }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: ModelSnapshotFieldManifestSource[] = [];
  if (configResult.config != null && configResult.configPath != null) {
    const baseDir = dirname(configResult.configPath);
    const declared = configResult.config.modelSnapshotFields?.sources ?? [];
    for (const source of declared) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }

  let registry: ModelSnapshotFieldRegistry = EMPTY_MODEL_SNAPSHOT_FIELD_REGISTRY;
  let loaderWarnings: readonly ModelSnapshotFieldLoaderWarning[] = [];

  const sources: readonly ModelSnapshotFieldManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    try {
      const loaded = await loadModelSnapshotFieldManifests({ sources, readFile });
      registry = createModelSnapshotFieldRegistry(loaded);
      loaderWarnings = loaded.warnings;
    } catch {
      // "zero manifests loaded successfully" — keep an empty registry so
      // a workspace that hasn't run `generate-manifests` yet still boots.
      registry = EMPTY_MODEL_SNAPSHOT_FIELD_REGISTRY;
    }
  }

  const result: LoadModelSnapshotFieldRegistryResult = {
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
 * @returns The absolute paths of the bundled `@dereekb/firebase` manifests.
 */
export function getDefaultBundledModelSnapshotFieldManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
