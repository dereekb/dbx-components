/**
 * Loader for model-firebase-index manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/firebase` registry
 * plus any downstream-app manifests discovered via `dbx-mcp.config.json`),
 * validates them against {@link ModelFirebaseIndexManifest}, and merges
 * them into a single lookup-ready registry.
 *
 * Failure handling mirrors the model-snapshot-fields loader: bundled
 * sources are strict by default, external sources are not. If no source
 * loads successfully the loader throws.
 */

import { ModelFirebaseIndexManifest, type ModelFirebaseIndexEntry } from './model-firebase-index-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type ModelFirebaseIndexManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type ModelFirebaseIndexManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type ModelFirebaseIndexLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadModelFirebaseIndexManifests}.
 */
export interface LoadModelFirebaseIndexManifestsInput {
  readonly sources: readonly ModelFirebaseIndexManifestSource[];
  readonly readFile?: ModelFirebaseIndexManifestReadFile;
}

/**
 * Result of {@link loadModelFirebaseIndexManifests}.
 */
export interface LoadModelFirebaseIndexManifestsResult {
  readonly entries: ReadonlyMap<string, ModelFirebaseIndexEntry>;
  readonly collectionIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly ModelFirebaseIndexLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a
 * single registry suitable for the `dbx_model_firebase_index_*` MCP
 * tools.
 *
 * @param input - Manifest sources plus an optional injected `readFile`
 * @returns Merged entries, collection index, deterministic warnings, and
 *   the list of source labels that loaded.
 * @throws {Error} When a strict source fails or when zero manifests load successfully.
 */
export async function loadModelFirebaseIndexManifests(input: LoadModelFirebaseIndexManifestsInput): Promise<LoadModelFirebaseIndexManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<ModelFirebaseIndexManifest, ModelFirebaseIndexEntry>(input, {
    name: 'loadModelFirebaseIndexManifests',
    schema: ModelFirebaseIndexManifest,
    extractIndexValue: (entry) => entry.collection,
    buildEntryKey: (manifest, entry) => `${manifest.module}::${entry.slug}`
  });
  return { entries, collectionIndex: indexMap, warnings, loadedSources };
}
