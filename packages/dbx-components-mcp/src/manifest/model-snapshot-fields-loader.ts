/**
 * Loader for model-snapshot-fields manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/firebase` registry plus
 * any downstream-app manifests discovered via `dbx-mcp.config.json`),
 * validates them against {@link ModelSnapshotFieldManifest}, and merges them
 * into a single lookup-ready registry.
 *
 * Failure handling mirrors the utils loader: bundled sources are strict by
 * default, external sources are not. If no source loads successfully the
 * loader throws.
 */

import { ModelSnapshotFieldManifest, type ModelSnapshotFieldEntry } from './model-snapshot-fields-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type ModelSnapshotFieldManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type ModelSnapshotFieldManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type ModelSnapshotFieldLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadModelSnapshotFieldManifests}.
 */
export interface LoadModelSnapshotFieldManifestsInput {
  readonly sources: readonly ModelSnapshotFieldManifestSource[];
  readonly readFile?: ModelSnapshotFieldManifestReadFile;
}

/**
 * Result of {@link loadModelSnapshotFieldManifests}. `entries` is the merged
 * lookup map keyed by `${module}::${slug}`; `categoryIndex` is the inverted
 * index from category value to entry keys (sorted alphabetically for
 * deterministic output).
 */
export interface LoadModelSnapshotFieldManifestsResult {
  readonly entries: ReadonlyMap<string, ModelSnapshotFieldEntry>;
  readonly categoryIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly ModelSnapshotFieldLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_model_snapshot_field_*` MCP tools.
 *
 * @param input - Manifest sources plus an optional injected `readFile`
 * @returns Merged entries, category index, deterministic warnings, and the list of source labels that loaded.
 * @throws {Error} When a strict source fails or when zero manifests load successfully.
 */
export async function loadModelSnapshotFieldManifests(input: LoadModelSnapshotFieldManifestsInput): Promise<LoadModelSnapshotFieldManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<ModelSnapshotFieldManifest, ModelSnapshotFieldEntry>(input, {
    name: 'loadModelSnapshotFieldManifests',
    schema: ModelSnapshotFieldManifest,
    extractIndexValue: (entry) => entry.category,
    buildEntryKey: (manifest, entry) => `${manifest.module}::${entry.slug}`
  });
  return { entries, categoryIndex: indexMap, warnings, loadedSources };
}
