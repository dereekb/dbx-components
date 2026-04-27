/**
 * Loader for pipes manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/*` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link PipeManifest}, and merges them into a single
 * lookup-ready registry.
 *
 * Failure handling mirrors the semantic-types and forge-fields loaders:
 * bundled sources are strict by default, external sources are not. If no
 * source loads successfully the loader throws.
 */

import { PipeManifest, type PipeEntry } from './pipes-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type PipeManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type PipeManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type PipeLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadPipeManifests}.
 */
export interface LoadPipeManifestsInput {
  readonly sources: readonly PipeManifestSource[];
  readonly readFile?: PipeManifestReadFile;
}

/**
 * Result of {@link loadPipeManifests}. `entries` is the merged lookup map
 * keyed by `${module}::${slug}`; `categoryIndex` is the inverted index from
 * category value to entry keys (sorted alphabetically for deterministic
 * output).
 */
export interface LoadPipeManifestsResult {
  readonly entries: ReadonlyMap<string, PipeEntry>;
  readonly categoryIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly PipeLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_pipe_lookup` MCP tool.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, category index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadPipeManifests(input: LoadPipeManifestsInput): Promise<LoadPipeManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<PipeManifest, PipeEntry>(input, {
    name: 'loadPipeManifests',
    schema: PipeManifest,
    extractIndexValue: (entry) => entry.category,
    buildEntryKey: (manifest, entry) => `${manifest.module}::${entry.slug}`
  });
  return { entries, categoryIndex: indexMap, warnings, loadedSources };
}
