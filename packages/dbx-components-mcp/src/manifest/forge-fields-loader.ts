/**
 * Loader for forge-fields manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/*` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link ForgeFieldManifest}, and merges them into a single
 * lookup-ready registry.
 *
 * Failure handling mirrors the semantic-types and ui-components loaders:
 * bundled sources are strict by default, external sources are not. If no
 * source loads successfully the loader throws.
 */

import { ForgeFieldManifest, type ForgeFieldEntry } from './forge-fields-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type ForgeFieldManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type ForgeFieldManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type ForgeFieldLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadForgeFieldManifests}.
 */
export interface LoadForgeFieldManifestsInput {
  readonly sources: readonly ForgeFieldManifestSource[];
  readonly readFile?: ForgeFieldManifestReadFile;
}

/**
 * Result of {@link loadForgeFieldManifests}. `entries` is the merged lookup
 * map keyed by `${module}::${slug}`; `tierIndex` is the inverted index from
 * tier value to entry keys (sorted alphabetically for deterministic output).
 */
export interface LoadForgeFieldManifestsResult {
  readonly entries: ReadonlyMap<string, ForgeFieldEntry>;
  readonly tierIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly ForgeFieldLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `lookup-form` / `search-form` MCP tools.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, tier index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadForgeFieldManifests(input: LoadForgeFieldManifestsInput): Promise<LoadForgeFieldManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<ForgeFieldManifest, ForgeFieldEntry>(input, {
    name: 'loadForgeFieldManifests',
    schema: ForgeFieldManifest,
    extractIndexValue: (entry) => entry.tier,
    buildEntryKey: (manifest, entry) => `${manifest.module}::${entry.slug}`
  });
  return { entries, tierIndex: indexMap, warnings, loadedSources };
}
