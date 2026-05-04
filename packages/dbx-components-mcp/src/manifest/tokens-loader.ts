/**
 * Loader for design-token manifests.
 *
 * Reads one or more manifest files (bundled `dereekb-dbx-web`,
 * `angular-material-m3`, `angular-material-mdc` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`),
 * validates them against {@link TokenManifest}, and merges them into a
 * single lookup-ready registry.
 *
 * Like the ui-components loader, the merged-map key is built from the
 * entry's own `source` field combined with `cssVariable` so the same
 * variable name can appear in multiple sources without colliding.
 */

import { TokenManifest, type TokenEntry } from './tokens-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export type TokenManifestSource = ManifestSource;

/**
 * Function shape used by the loader to read manifest contents.
 */
export type TokenManifestReadFile = ManifestReadFile;

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type TokenLoaderWarning = ManifestLoaderWarning;

/**
 * Input to {@link loadTokenManifests}.
 */
export interface LoadTokenManifestsInput {
  readonly sources: readonly TokenManifestSource[];
  readonly readFile?: TokenManifestReadFile;
}

/**
 * Result of {@link loadTokenManifests}. `entries` is the merged lookup
 * map keyed by `${entry.source}::${entry.cssVariable}`; `roleIndex` is
 * the inverted index from role to entry keys (sorted alphabetically).
 */
export interface LoadTokenManifestsResult {
  readonly entries: ReadonlyMap<string, TokenEntry>;
  readonly roleIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly TokenLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_css_token_lookup` and `dbx_ui_smell_check`
 * MCP tools.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, role index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadTokenManifests(input: LoadTokenManifestsInput): Promise<LoadTokenManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<TokenManifest, TokenEntry>(input, {
    name: 'loadTokenManifests',
    schema: TokenManifest,
    extractIndexValue: (entry) => entry.role,
    buildEntryKey: (_manifest, entry) => `${entry.source}::${entry.cssVariable}`
  });
  return { entries, roleIndex: indexMap, warnings, loadedSources };
}
