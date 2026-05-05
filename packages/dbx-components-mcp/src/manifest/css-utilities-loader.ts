/**
 * Loader for CSS-utility-class manifests.
 *
 * Reads one or more manifest files (the bundled
 * `dereekb-dbx-web.css-utilities.mcp.generated.json` plus any downstream
 * manifests discovered via `dbx-mcp.config.json`'s `cssUtilities` cluster
 * block), validates them against {@link CssUtilityManifest}, and merges
 * them into a single lookup-ready registry.
 *
 * The merged-map key combines the manifest's `source` label with the
 * entry's `slug` so the same slug can appear in multiple sources without
 * colliding. Mirrors the tokens loader.
 */

import { CssUtilityManifest, type CssUtilityEntry } from './css-utilities-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type CssUtilityManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type CssUtilityManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type CssUtilityLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadCssUtilityManifests}.
 */
export interface LoadCssUtilityManifestsInput {
  readonly sources: readonly CssUtilityManifestSource[];
  readonly readFile?: CssUtilityManifestReadFile;
}

/**
 * Result of {@link loadCssUtilityManifests}. `entries` is the merged lookup
 * map keyed by `${entry.source}::${entry.slug}`; `roleIndex` maps each role
 * to the alphabetically-sorted entry keys claiming it.
 */
export interface LoadCssUtilityManifestsResult {
  readonly entries: ReadonlyMap<string, CssUtilityEntry>;
  readonly roleIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly CssUtilityLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_css_class_lookup` MCP tool.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, role index, deterministic warnings, and the list
 *          of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadCssUtilityManifests(input: LoadCssUtilityManifestsInput): Promise<LoadCssUtilityManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<CssUtilityManifest, CssUtilityEntry>(input, {
    name: 'loadCssUtilityManifests',
    schema: CssUtilityManifest,
    extractIndexValue: (entry) => entry.role ?? 'misc',
    buildEntryKey: (_manifest, entry) => `${entry.source}::${entry.slug}`
  });
  return { entries, roleIndex: indexMap, warnings, loadedSources };
}
