/**
 * Loader for actions manifests.
 *
 * Reads one or more manifest files, validates them against
 * {@link ActionManifest}, and merges them into a single lookup-ready
 * registry. Mirrors the pipes / forge-fields / ui-components loaders via
 * the shared {@link loadManifestsBase} core.
 */

import { ActionManifest, type ActionEntry } from './actions-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type ActionManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type ActionManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type ActionLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadActionManifests}.
 */
export interface LoadActionManifestsInput {
  readonly sources: readonly ActionManifestSource[];
  readonly readFile?: ActionManifestReadFile;
}

/**
 * Result of {@link loadActionManifests}. `entries` is the merged lookup map
 * keyed by `${module}::${slug}`; `roleIndex` is the inverted index from role
 * to entry keys. `warnings` is sorted deterministically.
 */
export interface LoadActionManifestsResult {
  readonly entries: ReadonlyMap<string, ActionEntry>;
  readonly roleIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly ActionLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_action_lookup` MCP tool.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, role index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadActionManifests(input: LoadActionManifestsInput): Promise<LoadActionManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<ActionManifest, ActionEntry>(input, {
    name: 'loadActionManifests',
    schema: ActionManifest,
    extractIndexValue: (entry) => entry.role,
    buildEntryKey: (manifest, entry) => `${manifest.module}::${entry.slug}`
  });
  return { entries, roleIndex: indexMap, warnings, loadedSources };
}
