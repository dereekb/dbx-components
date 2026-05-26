/**
 * Loader for dbx-docs-ui-examples manifests.
 *
 * Reads one or more manifest files (bundled `apps/demo` registry plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link DbxDocsUiExampleManifest}, and merges them into a
 * single lookup-ready registry. Mirrors the `ui-components-loader`
 * structure: keyed by `${entry.module}::${entry.slug}`, indexed by
 * `entry.category`.
 */

import { DbxDocsUiExampleManifest, type DbxDocsUiExampleEntry } from './dbx-docs-ui-examples-schema.js';
import { loadManifestsBase, type ManifestLoaderWarning, type ManifestReadFile, type ManifestSource } from './manifest-loader-base.js';

// MARK: Public types
export type DbxDocsUiExamplesManifestSource = ManifestSource;
export type DbxDocsUiExamplesManifestReadFile = ManifestReadFile;
export type DbxDocsUiExamplesLoaderWarning = ManifestLoaderWarning;

export interface LoadDbxDocsUiExamplesManifestsInput {
  readonly sources: readonly DbxDocsUiExamplesManifestSource[];
  readonly readFile?: DbxDocsUiExamplesManifestReadFile;
}

export interface LoadDbxDocsUiExamplesManifestsResult {
  readonly entries: ReadonlyMap<string, DbxDocsUiExampleEntry>;
  readonly categoryIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly DbxDocsUiExamplesLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `dbx_ui_examples` / `dbx_ui_search` MCP tools.
 *
 * @param input - Sources to load and an optional `readFile` override for testing.
 * @returns Merged entry map keyed by `${module}::${slug}`, a category index, any warnings, and the list of successfully loaded source labels.
 */
export async function loadDbxDocsUiExamplesManifests(input: LoadDbxDocsUiExamplesManifestsInput): Promise<LoadDbxDocsUiExamplesManifestsResult> {
  const { entries, indexMap, warnings, loadedSources } = await loadManifestsBase<DbxDocsUiExampleManifest, DbxDocsUiExampleEntry>(input, {
    name: 'loadDbxDocsUiExamplesManifests',
    schema: DbxDocsUiExampleManifest,
    extractIndexValue: (entry) => entry.category,
    buildEntryKey: (_manifest, entry) => `${entry.module}::${entry.slug}`
  });
  return { entries, categoryIndex: indexMap, warnings, loadedSources };
}
