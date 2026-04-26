/**
 * Loader for ui-components manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/*` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link UiComponentManifest}, and merges them into a single
 * lookup-ready registry.
 *
 * The loader never performs file I/O directly inside the merge logic — all
 * reads go through an injectable `readFile` so loader tests run entirely
 * in-memory. Only the `DEFAULT_READ_FILE` (and any caller-supplied
 * alternative) touches the disk.
 *
 * Failure handling mirrors the semantic-types loader: bundled sources are
 * strict by default, external sources are not. If no source loads
 * successfully the loader throws — silent empty registries are the worst
 * failure mode.
 */

import { readFile as nodeReadFile } from 'node:fs/promises';
import { type } from 'arktype';
import { UiComponentManifest, type UiComponentEntry } from './ui-components-schema.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute (the
 * caller is responsible for resolving any repo-relative
 * `dbx-mcp.config.json` entries against the config file's directory before
 * invoking the loader).
 */
export interface UiComponentManifestSource {
  readonly origin: 'bundled' | 'external';
  readonly path: string;
  readonly strict?: boolean;
}

/**
 * Function shape used by the loader to read manifest contents. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')` when not supplied.
 */
export type UiComponentManifestReadFile = (absolutePath: string) => Promise<string>;

/**
 * Input to {@link loadUiComponentManifests}.
 */
export interface LoadUiComponentManifestsInput {
  readonly sources: readonly UiComponentManifestSource[];
  readonly readFile?: UiComponentManifestReadFile;
}

/**
 * Result of {@link loadUiComponentManifests}. `entries` is the merged lookup
 * map keyed by `${module}::${slug}`; `categoryIndex` is the inverted index
 * from category to entry keys (sorted alphabetically for deterministic
 * output). `warnings` is sorted deterministically so test assertions over
 * the array are stable across runs.
 */
export interface LoadUiComponentManifestsResult {
  readonly entries: ReadonlyMap<string, UiComponentEntry>;
  readonly categoryIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly UiComponentLoaderWarning[];
  readonly loadedSources: readonly string[];
}

/**
 * Discriminated union of all non-fatal events the loader emits. Strict
 * sources convert these into thrown errors; non-strict sources collect
 * them into the result's `warnings` array.
 */
export type UiComponentLoaderWarning =
  | { readonly kind: 'manifest-missing'; readonly path: string }
  | { readonly kind: 'manifest-parse-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-schema-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-version-unsupported'; readonly path: string; readonly version: unknown }
  | { readonly kind: 'source-label-collision'; readonly source: string; readonly existingPath: string; readonly droppedPath: string }
  | { readonly kind: 'entry-collision'; readonly entryKey: string; readonly winningSource: string; readonly losingSource: string };

// MARK: Internal types
type LoadFromSourceResult = { readonly kind: 'success'; readonly manifest: UiComponentManifest } | { readonly kind: 'failure'; readonly warning: UiComponentLoaderWarning };

const DEFAULT_READ_FILE: UiComponentManifestReadFile = (path) => nodeReadFile(path, 'utf-8');
const SUPPORTED_VERSION = 1;

// MARK: Source loading
async function loadFromSource(source: UiComponentManifestSource, readFile: UiComponentManifestReadFile): Promise<LoadFromSourceResult> {
  let raw: string | null = null;
  try {
    raw = await readFile(source.path);
  } catch {
    raw = null;
  }

  let result: LoadFromSourceResult;
  if (raw === null) {
    result = { kind: 'failure', warning: { kind: 'manifest-missing', path: source.path } };
  } else {
    let parsed: unknown;
    let parseError: string | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
    if (parseError === null) {
      const candidateVersion = (parsed as { readonly version?: unknown } | null | undefined)?.version;
      if (candidateVersion === SUPPORTED_VERSION) {
        const validated = UiComponentManifest(parsed);
        if (validated instanceof type.errors) {
          result = { kind: 'failure', warning: { kind: 'manifest-schema-failed', path: source.path, error: validated.summary } };
        } else {
          result = { kind: 'success', manifest: validated };
        }
      } else {
        result = { kind: 'failure', warning: { kind: 'manifest-version-unsupported', path: source.path, version: candidateVersion } };
      }
    } else {
      result = { kind: 'failure', warning: { kind: 'manifest-parse-failed', path: source.path, error: parseError } };
    }
  }
  return result;
}

function isStrictSource(source: UiComponentManifestSource): boolean {
  return source.strict ?? source.origin === 'bundled';
}

// MARK: Warning ordering
function warningSortKey(warning: UiComponentLoaderWarning): string {
  let key: string;
  switch (warning.kind) {
    case 'manifest-missing':
    case 'manifest-parse-failed':
    case 'manifest-schema-failed':
      key = `${warning.kind}|${warning.path}`;
      break;
    case 'manifest-version-unsupported':
      key = `${warning.kind}|${warning.path}|${String(warning.version)}`;
      break;
    case 'source-label-collision':
      key = `${warning.kind}|${warning.source}|${warning.droppedPath}`;
      break;
    case 'entry-collision':
      key = `${warning.kind}|${warning.entryKey}|${warning.winningSource}|${warning.losingSource}`;
      break;
  }
  return key;
}

// MARK: Entry point
/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the `lookup-ui` / `search-ui` MCP tools.
 *
 * Strict sources fail loud; non-strict sources fail soft. If every source
 * fails — strict or not — the loader throws, since a silent empty registry
 * provides no value to a downstream agent.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, category index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadUiComponentManifests(input: LoadUiComponentManifestsInput): Promise<LoadUiComponentManifestsResult> {
  const { sources, readFile = DEFAULT_READ_FILE } = input;
  const successes: { readonly source: UiComponentManifestSource; readonly manifest: UiComponentManifest }[] = [];
  const warnings: UiComponentLoaderWarning[] = [];

  for (const source of sources) {
    const outcome = await loadFromSource(source, readFile);
    if (outcome.kind === 'success') {
      successes.push({ source, manifest: outcome.manifest });
    } else if (isStrictSource(source)) {
      throw new Error(`loadUiComponentManifests: strict source failed (${outcome.warning.kind}): ${source.path}`);
    } else {
      warnings.push(outcome.warning);
    }
  }

  if (successes.length === 0) {
    throw new Error('loadUiComponentManifests: zero manifests loaded successfully');
  }

  const seenSources = new Map<string, string>();
  const mergedEntries = new Map<string, UiComponentEntry>();
  const entryProvenance = new Map<string, string>();
  const loadedSources: string[] = [];

  for (const { source, manifest } of successes) {
    const existingPath = seenSources.get(manifest.source);
    if (existingPath !== undefined) {
      warnings.push({
        kind: 'source-label-collision',
        source: manifest.source,
        existingPath,
        droppedPath: source.path
      });
      continue;
    }
    seenSources.set(manifest.source, source.path);
    loadedSources.push(manifest.source);

    for (const entry of manifest.entries) {
      const entryKey = `${entry.module}::${entry.slug}`;
      const previousSource = entryProvenance.get(entryKey);
      if (previousSource !== undefined) {
        warnings.push({
          kind: 'entry-collision',
          entryKey,
          winningSource: manifest.source,
          losingSource: previousSource
        });
      }
      mergedEntries.set(entryKey, entry);
      entryProvenance.set(entryKey, manifest.source);
    }
  }

  const categoryIndex = new Map<string, readonly string[]>();
  for (const [entryKey, entry] of mergedEntries) {
    const existing = categoryIndex.get(entry.category);
    if (existing === undefined) {
      categoryIndex.set(entry.category, [entryKey]);
    } else {
      categoryIndex.set(entry.category, [...existing, entryKey]);
    }
  }
  for (const [category, keys] of categoryIndex) {
    categoryIndex.set(
      category,
      [...keys].sort((a, b) => a.localeCompare(b))
    );
  }

  warnings.sort((a, b) => warningSortKey(a).localeCompare(warningSortKey(b)));

  return {
    entries: mergedEntries,
    categoryIndex,
    warnings,
    loadedSources
  };
}
