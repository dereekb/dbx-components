/**
 * Loader for utils manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/*` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link UtilManifest}, and merges them into a single
 * lookup-ready registry.
 *
 * Failure handling mirrors the pipes loader: bundled sources are strict by
 * default, external sources are not. If no source loads successfully the
 * loader throws.
 */

import { UtilManifest, type UtilEntry } from './utils-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type UtilManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type UtilManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type UtilLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadUtilManifests}.
 */
export interface LoadUtilManifestsInput {
  readonly sources: readonly UtilManifestSource[];
  readonly readFile?: UtilManifestReadFile;
}

/**
 * Result of {@link loadUtilManifests}. `entries` is the merged lookup map
 * keyed by `${module}::${slug}`; `categoryIndex` is the inverted index
 * from category value to entry keys (sorted alphabetically for
 * deterministic output).
 */
export interface LoadUtilManifestsResult {
  readonly entries: ReadonlyMap<string, UtilEntry>;
  readonly categoryIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly UtilLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_util_lookup` / `dbx_util_search` MCP tools.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, category index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadUtilManifests(input: LoadUtilManifestsInput): Promise<LoadUtilManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<UtilManifest, UtilEntry>(input, {
    name: 'loadUtilManifests',
    schema: UtilManifest,
    extractIndexValue: (entry) => entry.category,
    buildEntryKey: (manifest, entry) => `${manifest.module}::${entry.slug}`
  });
  return { entries, categoryIndex: indexMap, warnings, loadedSources };
}
