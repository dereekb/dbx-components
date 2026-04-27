/**
 * Loader for filters manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/*` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link FilterManifest}, and merges them into a single
 * lookup-ready registry.
 *
 * Failure handling mirrors the semantic-types and pipes loaders: bundled
 * sources are strict by default, external sources are not. If no source
 * loads successfully the loader throws — silent empty registries are the
 * worst failure mode.
 */

import { FilterManifest, type FilterEntry } from './filters-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute (the
 * caller resolves any repo-relative `dbx-mcp.config.json` entries against
 * the config file's directory before invoking the loader).
 */
export type FilterManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')` when not supplied.
 */
export type FilterManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits. Strict
 * sources convert these into thrown errors; non-strict sources collect
 * them into the result's `warnings` array.
 */
export type FilterLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadFilterManifests}.
 */
export interface LoadFilterManifestsInput {
  readonly sources: readonly FilterManifestSource[];
  readonly readFile?: FilterManifestReadFile;
}

/**
 * Result of {@link loadFilterManifests}. `entries` is the merged lookup map
 * keyed by `${module}::${slug}`; `kindIndex` is the inverted index from
 * kind value to entry keys (sorted alphabetically for deterministic output).
 * `warnings` is sorted deterministically so test assertions are stable
 * across runs.
 */
export interface LoadFilterManifestsResult {
  readonly entries: ReadonlyMap<string, FilterEntry>;
  readonly kindIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly FilterLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_filter_lookup` MCP tool.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, kind index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadFilterManifests(input: LoadFilterManifestsInput): Promise<LoadFilterManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<FilterManifest, FilterEntry>(input, {
    name: 'loadFilterManifests',
    schema: FilterManifest,
    extractIndexValue: (entry) => entry.kind,
    buildEntryKey: (manifest, entry) => `${manifest.module}::${entry.slug}`
  });
  return { entries, kindIndex: indexMap, warnings, loadedSources };
}
