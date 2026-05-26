/**
 * Generic core for the per-domain manifest loaders (actions, filters,
 * forge-fields, pipes, ui-components).
 *
 * Each domain loader (`actions-loader.ts`, etc.) is a thin wrapper that
 * supplies an arktype schema, an index-key extractor, and an entry-key
 * builder. The orchestration — read, parse, version-check, schema-validate,
 * merge, dedupe, sort — lives here so the five domains do not duplicate
 * ~150 lines of identical procedural code each.
 *
 * The semantic-types loader (`loader.ts`) is intentionally not migrated to
 * this base: it carries extra topic-filtering logic and a different result
 * shape, so consolidating it would expand scope without removing
 * meaningful duplication.
 */

import type { Maybe } from '@dereekb/util';
import { readFile as nodeReadFile } from 'node:fs/promises';
import { type } from 'arktype';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute (the
 * caller resolves any repo-relative `dbx-mcp.config.json` entries against
 * the config file's directory before invoking the loader).
 */
export interface ManifestSource {
  readonly origin: 'bundled' | 'external';
  readonly path: string;
  readonly strict?: boolean;
}

/**
 * Function shape used by the loader to read manifest contents. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')` when not supplied.
 */
export type ManifestReadFile = (absolutePath: string) => Promise<string>;

/**
 * Discriminated union of all non-fatal events the loader emits. Strict
 * sources convert these into thrown errors; non-strict sources collect
 * them into the result's `warnings` array.
 */
export type ManifestLoaderWarning =
  | { readonly kind: 'manifest-missing'; readonly path: string }
  | { readonly kind: 'manifest-parse-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-schema-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-version-unsupported'; readonly path: string; readonly version: unknown }
  | { readonly kind: 'source-label-collision'; readonly source: string; readonly existingPath: string; readonly droppedPath: string }
  | { readonly kind: 'entry-collision'; readonly entryKey: string; readonly winningSource: string; readonly losingSource: string };

/**
 * The minimum manifest envelope shape the base loader needs to merge a
 * source. Each domain's full manifest type is a structural superset of
 * this.
 */
export interface BaseManifest<TEntry> {
  readonly source: string;
  readonly entries: readonly TEntry[];
}

/**
 * Per-domain configuration for {@link loadManifestsBase}.
 */
export interface ManifestLoaderConfig<TManifest extends BaseManifest<TEntry>, TEntry> {
  /**
   * Function name used in error messages — e.g. `loadActionManifests`.
   */
  readonly name: string;
  /**
   * Arktype validator for the domain's manifest envelope. The raw return
   * value (`TManifest | type.errors`) is interrogated with `instanceof
   * type.errors`.
   */
  readonly schema: (parsed: unknown) => TManifest | type.errors;
  /**
   * Pulls the inverted-index key out of one entry (e.g. `entry.role` for
   * actions, `entry.kind` for filters).
   */
  readonly extractIndexValue: (entry: TEntry) => string;
  /**
   * Builds the merged-map key for one entry. Most domains use
   * `${manifest.module}::${entry.slug}`; ui-components reads `module`
   * from the entry itself instead of the envelope.
   */
  readonly buildEntryKey: (manifest: TManifest, entry: TEntry) => string;
}

/**
 * Input to {@link loadManifestsBase}.
 */
export interface ManifestLoaderInput {
  readonly sources: readonly ManifestSource[];
  readonly readFile?: ManifestReadFile;
}

/**
 * Generic result of {@link loadManifestsBase}. Domain wrappers re-emit
 * `indexMap` under their own property name (`roleIndex`, `kindIndex`,
 * `tierIndex`, `categoryIndex`).
 */
export interface ManifestLoaderBaseResult<TEntry> {
  readonly entries: ReadonlyMap<string, TEntry>;
  readonly indexMap: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly ManifestLoaderWarning[];
  readonly loadedSources: readonly string[];
}

// MARK: Internal types
type LoadFromSourceResult<TManifest> = { readonly kind: 'success'; readonly manifest: TManifest } | { readonly kind: 'failure'; readonly warning: ManifestLoaderWarning };

const DEFAULT_READ_FILE: ManifestReadFile = (path) => nodeReadFile(path, 'utf-8');
const SUPPORTED_VERSION = 1;

// MARK: Source loading
type ParseRawResult = { readonly kind: 'parsed'; readonly value: unknown } | { readonly kind: 'error'; readonly error: string };

function tryReadRaw(path: string, readFile: ManifestReadFile): Promise<Maybe<string>> {
  return readFile(path).then(
    (raw) => raw,
    () => null
  );
}

function tryParseRaw(raw: string): ParseRawResult {
  let result: ParseRawResult;
  try {
    result = { kind: 'parsed', value: JSON.parse(raw) };
  } catch (err) {
    result = { kind: 'error', error: err instanceof Error ? err.message : String(err) };
  }
  return result;
}

function validateParsedManifest<TManifest>(path: string, parsed: unknown, schema: (parsed: unknown) => TManifest | type.errors): LoadFromSourceResult<TManifest> {
  const candidateVersion = (parsed as Maybe<{ readonly version?: unknown }>)?.version;
  let result: LoadFromSourceResult<TManifest>;

  if (candidateVersion === SUPPORTED_VERSION) {
    const validated = schema(parsed);
    if (validated instanceof type.errors) {
      result = { kind: 'failure', warning: { kind: 'manifest-schema-failed', path, error: validated.summary } };
    } else {
      result = { kind: 'success', manifest: validated };
    }
  } else {
    result = { kind: 'failure', warning: { kind: 'manifest-version-unsupported', path, version: candidateVersion } };
  }

  return result;
}

async function loadFromSource<TManifest>(source: ManifestSource, readFile: ManifestReadFile, schema: (parsed: unknown) => TManifest | type.errors): Promise<LoadFromSourceResult<TManifest>> {
  const raw = await tryReadRaw(source.path, readFile);
  let result: LoadFromSourceResult<TManifest>;

  if (raw == null) {
    result = { kind: 'failure', warning: { kind: 'manifest-missing', path: source.path } };
  } else {
    const parseResult = tryParseRaw(raw);
    if (parseResult.kind === 'error') {
      result = { kind: 'failure', warning: { kind: 'manifest-parse-failed', path: source.path, error: parseResult.error } };
    } else {
      result = validateParsedManifest(source.path, parseResult.value, schema);
    }
  }

  return result;
}

function isStrictSource(source: ManifestSource): boolean {
  return source.strict ?? source.origin === 'bundled';
}

// MARK: Warning ordering
function warningSortKey(warning: ManifestLoaderWarning): string {
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
interface SourceLoadAccumulator<TManifest> {
  readonly successes: { readonly source: ManifestSource; readonly manifest: TManifest }[];
  readonly warnings: ManifestLoaderWarning[];
}

async function collectSourceOutcomes<TManifest>(config: { readonly sources: readonly ManifestSource[]; readonly readFile: ManifestReadFile; readonly schema: (parsed: unknown) => TManifest | type.errors; readonly name: string }): Promise<SourceLoadAccumulator<TManifest>> {
  const { sources, readFile, schema, name } = config;
  const successes: { readonly source: ManifestSource; readonly manifest: TManifest }[] = [];
  const warnings: ManifestLoaderWarning[] = [];

  for (const source of sources) {
    const outcome = await loadFromSource(source, readFile, schema);
    if (outcome.kind === 'success') {
      successes.push({ source, manifest: outcome.manifest });
    } else if (isStrictSource(source)) {
      throw new Error(`${name}: strict source failed (${outcome.warning.kind}): ${source.path}`);
    } else {
      warnings.push(outcome.warning);
    }
  }

  return { successes, warnings };
}

interface MergeManifestContext<TManifest extends BaseManifest<TEntry>, TEntry> {
  readonly source: ManifestSource;
  readonly manifest: TManifest;
  readonly buildEntryKey: (manifest: TManifest, entry: TEntry) => string;
  readonly seenSources: Map<string, string>;
  readonly loadedSources: string[];
  readonly mergedEntries: Map<string, TEntry>;
  readonly entryProvenance: Map<string, string>;
  readonly warnings: ManifestLoaderWarning[];
}

function mergeManifest<TManifest extends BaseManifest<TEntry>, TEntry>(context: MergeManifestContext<TManifest, TEntry>): void {
  const { source, manifest, buildEntryKey, seenSources, loadedSources, mergedEntries, entryProvenance, warnings } = context;
  const existingPath = seenSources.get(manifest.source);
  if (existingPath !== undefined) {
    warnings.push({ kind: 'source-label-collision', source: manifest.source, existingPath, droppedPath: source.path });
    return;
  }
  seenSources.set(manifest.source, source.path);
  loadedSources.push(manifest.source);

  for (const entry of manifest.entries) {
    const entryKey = buildEntryKey(manifest, entry);
    const previousSource = entryProvenance.get(entryKey);
    if (previousSource !== undefined) {
      warnings.push({ kind: 'entry-collision', entryKey, winningSource: manifest.source, losingSource: previousSource });
    }
    mergedEntries.set(entryKey, entry);
    entryProvenance.set(entryKey, manifest.source);
  }
}

function buildIndexMap<TEntry>(mergedEntries: ReadonlyMap<string, TEntry>, extractIndexValue: (entry: TEntry) => string): Map<string, readonly string[]> {
  const indexMap = new Map<string, readonly string[]>();
  for (const [entryKey, entry] of mergedEntries) {
    const indexValue = extractIndexValue(entry);
    const existing = indexMap.get(indexValue);
    indexMap.set(indexValue, existing === undefined ? [entryKey] : [...existing, entryKey]);
  }
  for (const [indexValue, keys] of indexMap) {
    indexMap.set(
      indexValue,
      [...keys].sort((a, b) => a.localeCompare(b))
    );
  }
  return indexMap;
}

/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry. Strict sources fail loud; non-strict sources fail soft. If
 * every source fails — strict or not — the loader throws, since a silent
 * empty registry provides no value to a downstream agent.
 *
 * Domain wrappers translate the generic result fields into their named
 * shape (e.g. `indexMap` → `roleIndex`).
 *
 * @param input - Manifest sources plus an optional injected `readFile`
 * @param config - Per-domain schema + key extractors + name for error messages.
 * @returns Merged entries, generic index map, deterministic warnings, and the list of source labels that loaded.
 * @throws {Error} When a strict source fails or when zero manifests load successfully.
 */
export async function loadManifestsBase<TManifest extends BaseManifest<TEntry>, TEntry>(input: ManifestLoaderInput, config: ManifestLoaderConfig<TManifest, TEntry>): Promise<ManifestLoaderBaseResult<TEntry>> {
  const { sources, readFile = DEFAULT_READ_FILE } = input;
  const { name, schema, extractIndexValue, buildEntryKey } = config;

  const { successes, warnings } = await collectSourceOutcomes({ sources, readFile, schema, name });

  if (successes.length === 0) {
    throw new Error(`${name}: zero manifests loaded successfully`);
  }

  const seenSources = new Map<string, string>();
  const mergedEntries = new Map<string, TEntry>();
  const entryProvenance = new Map<string, string>();
  const loadedSources: string[] = [];

  for (const { source, manifest } of successes) {
    mergeManifest({ source, manifest, buildEntryKey, seenSources, loadedSources, mergedEntries, entryProvenance, warnings });
  }

  const indexMap = buildIndexMap(mergedEntries, extractIndexValue);
  warnings.sort((a, b) => warningSortKey(a).localeCompare(warningSortKey(b)));

  return {
    entries: mergedEntries,
    indexMap,
    warnings,
    loadedSources
  };
}
