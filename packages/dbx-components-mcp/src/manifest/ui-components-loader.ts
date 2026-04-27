/**
 * Loader for ui-components manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/*` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link UiComponentManifest}, and merges them into a single
 * lookup-ready registry.
 *
 * Unlike the other domain loaders, ui-components builds its merged-map key
 * from `entry.module` rather than `manifest.module` — entries can carry a
 * package label that differs from the manifest envelope's module field
 * (e.g. components re-exported from sibling packages).
 */

import { UiComponentManifest, type UiComponentEntry } from './ui-components-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type UiComponentManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type UiComponentManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type UiComponentLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadUiComponentManifests}.
 */
export interface LoadUiComponentManifestsInput {
  readonly sources: readonly UiComponentManifestSource[];
  readonly readFile?: UiComponentManifestReadFile;
}

/**
 * Result of {@link loadUiComponentManifests}. `entries` is the merged lookup
 * map keyed by `${entry.module}::${entry.slug}`; `categoryIndex` is the
 * inverted index from category to entry keys (sorted alphabetically).
 */
export interface LoadUiComponentManifestsResult {
  readonly entries: ReadonlyMap<string, UiComponentEntry>;
  readonly categoryIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly UiComponentLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `lookup-ui` / `search-ui` MCP tools.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, category index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadUiComponentManifests(input: LoadUiComponentManifestsInput): Promise<LoadUiComponentManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<UiComponentManifest, UiComponentEntry>(input, {
    name: 'loadUiComponentManifests',
    schema: UiComponentManifest,
    extractIndexValue: (entry) => entry.category,
    buildEntryKey: (_manifest, entry) => `${entry.module}::${entry.slug}`
  });
  return { entries, categoryIndex: indexMap, warnings, loadedSources };
}
