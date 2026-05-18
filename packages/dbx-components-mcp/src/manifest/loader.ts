/**
 * Loader for semantic-types manifests.
 *
 * Reads one or more manifest files (bundled `@dereekb/*` registries plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json`), validates
 * them against {@link SemanticTypeManifest}, and merges them into a single
 * lookup-ready registry.
 *
 * The loader never performs file I/O directly inside the merge logic — all
 * reads go through an injectable `readFile` so loader tests run entirely
 * in-memory. Only `defaultReadFile` (and any caller-supplied alternative)
 * touches the disk.
 *
 * Failure handling is split between *strict* and non-strict sources:
 *   - **Strict** sources (default for `origin: 'bundled'`) throw on any
 *     parse, version, or schema failure — these failures indicate a build
 *     bug, not a configuration problem.
 *   - **Non-strict** sources (default for `origin: 'external'`) emit a
 *     {@link LoaderWarning} and are skipped, so a single malformed
 *     downstream manifest does not take the registry down.
 *
 * If no source loads successfully (every source failed warn-and-skip) the
 * loader throws — silent empty registries are the worst failure mode.
 */

import type { Maybe } from '@dereekb/util';
import { readFile as nodeReadFile } from 'node:fs/promises';
import { type } from 'arktype';
import { isCoreTopic } from './core-topics.js';
import { SemanticTypeManifest, type SemanticTypeEntry } from './semantic-types-schema.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute (the
 * caller is responsible for resolving any repo-relative `dbx-mcp.config.json`
 * entries against the config file's directory before invoking the loader).
 *
 * `strict` defaults to `true` for `origin: 'bundled'` and `false` for
 * `origin: 'external'`. Override the default to e.g. enforce strict
 * validation on a known-good external source during CI.
 */
export interface ManifestSource {
  readonly origin: 'bundled' | 'external';
  readonly path: string;
  readonly strict?: boolean;
}

/**
 * Function shape used by the loader to read manifest contents. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')` when not supplied. Tests
 * inject a Map-backed implementation so they can drive the loader without
 * touching disk.
 */
export type ManifestReadFile = (absolutePath: string) => Promise<string>;

/**
 * Input to {@link loadSemanticTypeManifests}.
 */
export interface LoadSemanticTypeManifestsInput {
  readonly sources: readonly ManifestSource[];
  readonly readFile?: ManifestReadFile;
}

/**
 * Result of {@link loadSemanticTypeManifests}. `entries` is the merged
 * lookup map keyed by `${package}::${name}`; `topicsIndex` is the inverted
 * index from topic to entry keys (each bucket sorted alphabetically for
 * deterministic output). `warnings` is sorted deterministically so test
 * assertions over the array are stable across runs.
 */
export interface LoadSemanticTypeManifestsResult {
  readonly entries: ReadonlyMap<string, SemanticTypeEntry>;
  readonly topicsIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly LoaderWarning[];
  readonly loadedSources: readonly string[];
}

/**
 * Discriminated union of all non-fatal events the loader emits. Strict
 * sources convert these into thrown errors; non-strict sources collect
 * them into the result's `warnings` array.
 */
export type LoaderWarning =
  | { readonly kind: 'manifest-missing'; readonly path: string }
  | { readonly kind: 'manifest-parse-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-schema-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-version-unsupported'; readonly path: string; readonly version: unknown }
  | { readonly kind: 'source-label-collision'; readonly source: string; readonly existingPath: string; readonly droppedPath: string }
  | { readonly kind: 'entry-collision'; readonly entryKey: string; readonly winningSource: string; readonly losingSource: string }
  | { readonly kind: 'topic-unknown-core'; readonly entryKey: string; readonly topic: string }
  | { readonly kind: 'topic-namespace-mismatch'; readonly entryKey: string; readonly topic: string; readonly expectedNamespace: string };

// MARK: Internal types
type LoadFromSourceResult = { readonly kind: 'success'; readonly manifest: SemanticTypeManifest } | { readonly kind: 'failure'; readonly warning: LoaderWarning };

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

function validateParsedManifest(path: string, parsed: unknown): LoadFromSourceResult {
  const candidateVersion = (parsed as Maybe<{ readonly version?: unknown }>)?.version;
  let result: LoadFromSourceResult;

  if (candidateVersion === SUPPORTED_VERSION) {
    const validated = SemanticTypeManifest(parsed);
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

/**
 * Reads, parses, and validates a single manifest source. Failures are
 * surfaced as {@link LoaderWarning} values; the caller decides whether
 * to throw (strict source) or collect (non-strict source).
 *
 * @param source - The manifest source descriptor.
 * @param readFile - Injectable file reader.
 * @returns Either the validated manifest or a typed failure warning.
 */
async function loadFromSource(source: ManifestSource, readFile: ManifestReadFile): Promise<LoadFromSourceResult> {
  const raw = await tryReadRaw(source.path, readFile);
  let result: LoadFromSourceResult;

  if (raw === null) {
    result = { kind: 'failure', warning: { kind: 'manifest-missing', path: source.path } };
  } else {
    const parseResult = tryParseRaw(raw);
    if (parseResult.kind === 'error') {
      result = { kind: 'failure', warning: { kind: 'manifest-parse-failed', path: source.path, error: parseResult.error } };
    } else {
      result = validateParsedManifest(source.path, parseResult.value);
    }
  }

  return result;
}

/**
 * Returns the strict flag for a source, applying the documented defaults
 * (bundled sources are strict; external sources are not) when the source
 * does not override.
 *
 * @param source - The manifest source descriptor.
 * @returns Whether failures from `source` should throw (`true`) or warn.
 */
function isStrictSource(source: ManifestSource): boolean {
  return source.strict ?? source.origin === 'bundled';
}

// MARK: Topic filtering
interface FilteredTopics {
  readonly topics: readonly string[];
  readonly warnings: readonly LoaderWarning[];
}

/**
 * Validates each topic on an entry against the loader's two-tier topic
 * vocabulary (closed core + per-manifest namespace). Unrecognised topics
 * are stripped and a {@link LoaderWarning} is emitted per drop; the entry
 * is preserved with whatever topics survived.
 *
 * @param config - Validation context for one entry's topic list.
 * @param config.entryKey - `${package}::${name}` key of the owning entry.
 * @param config.topics - The entry's declared topics.
 * @param config.topicNamespace - The manifest's `topicNamespace` (prefix for namespaced topics)
 * @returns The filtered topic list plus any warnings produced during filtering.
 */
function filterEntryTopics(config: { readonly entryKey: string; readonly topics: readonly string[]; readonly topicNamespace: string }): FilteredTopics {
  const { entryKey, topics, topicNamespace } = config;
  const kept: string[] = [];
  const warnings: LoaderWarning[] = [];

  for (const topic of topics) {
    const colonIndex = topic.indexOf(':');
    if (colonIndex >= 0) {
      const prefix = topic.slice(0, colonIndex);
      if (prefix === topicNamespace) {
        kept.push(topic);
      } else {
        warnings.push({ kind: 'topic-namespace-mismatch', entryKey, topic, expectedNamespace: topicNamespace });
      }
    } else if (isCoreTopic(topic)) {
      kept.push(topic);
    } else {
      warnings.push({ kind: 'topic-unknown-core', entryKey, topic });
    }
  }

  return { topics: kept, warnings };
}

// MARK: Warning ordering
/**
 * Builds a stable string key from a warning so the loader can return
 * warnings in deterministic order regardless of how they were collected.
 *
 * @param warning - The warning to derive a sort key for.
 * @returns Ordered first by `kind` then by the warning's primary identifiers. (string)
 */
function warningSortKey(warning: LoaderWarning): string {
  let key: string;
  switch (warning.kind) {
    case 'manifest-missing':
      key = `${warning.kind}|${warning.path}`;
      break;
    case 'manifest-parse-failed':
      key = `${warning.kind}|${warning.path}`;
      break;
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
    case 'topic-unknown-core':
      key = `${warning.kind}|${warning.entryKey}|${warning.topic}`;
      break;
    case 'topic-namespace-mismatch':
      key = `${warning.kind}|${warning.entryKey}|${warning.topic}`;
      break;
  }
  return key;
}

// MARK: Entry point
interface SourceLoadAccumulator {
  readonly successes: { readonly source: ManifestSource; readonly manifest: SemanticTypeManifest }[];
  readonly warnings: LoaderWarning[];
}

async function collectSourceOutcomes(sources: readonly ManifestSource[], readFile: ManifestReadFile): Promise<SourceLoadAccumulator> {
  const successes: { readonly source: ManifestSource; readonly manifest: SemanticTypeManifest }[] = [];
  const warnings: LoaderWarning[] = [];

  for (const source of sources) {
    const outcome = await loadFromSource(source, readFile);
    if (outcome.kind === 'success') {
      successes.push({ source, manifest: outcome.manifest });
    } else if (isStrictSource(source)) {
      throw new Error(`loadSemanticTypeManifests: strict source failed (${outcome.warning.kind}): ${source.path}`);
    } else {
      warnings.push(outcome.warning);
    }
  }

  return { successes, warnings };
}

interface MergeEntryContext {
  readonly manifest: SemanticTypeManifest;
  readonly entry: SemanticTypeEntry;
  readonly mergedEntries: Map<string, SemanticTypeEntry>;
  readonly entryProvenance: Map<string, string>;
  readonly warnings: LoaderWarning[];
}

function mergeEntry(context: MergeEntryContext): void {
  const { manifest, entry, mergedEntries, entryProvenance, warnings } = context;
  const entryKey = `${entry.package}::${entry.name}`;
  const filtered = filterEntryTopics({ entryKey, topics: entry.topics, topicNamespace: manifest.topicNamespace });
  warnings.push(...filtered.warnings);

  const mergedEntry: SemanticTypeEntry = { ...entry, topics: [...filtered.topics] };
  const previousSource = entryProvenance.get(entryKey);
  if (previousSource !== undefined) {
    warnings.push({ kind: 'entry-collision', entryKey, winningSource: manifest.source, losingSource: previousSource });
  }
  mergedEntries.set(entryKey, mergedEntry);
  entryProvenance.set(entryKey, manifest.source);
}

interface MergeManifestContext {
  readonly source: ManifestSource;
  readonly manifest: SemanticTypeManifest;
  readonly seenSources: Map<string, string>;
  readonly loadedSources: string[];
  readonly mergedEntries: Map<string, SemanticTypeEntry>;
  readonly entryProvenance: Map<string, string>;
  readonly warnings: LoaderWarning[];
}

function mergeManifest(context: MergeManifestContext): void {
  const { source, manifest, seenSources, loadedSources, mergedEntries, entryProvenance, warnings } = context;
  const existingPath = seenSources.get(manifest.source);
  if (existingPath !== undefined) {
    warnings.push({ kind: 'source-label-collision', source: manifest.source, existingPath, droppedPath: source.path });
    return;
  }
  seenSources.set(manifest.source, source.path);
  loadedSources.push(manifest.source);

  for (const entry of manifest.entries) {
    mergeEntry({ manifest, entry, mergedEntries, entryProvenance, warnings });
  }
}

function buildTopicsIndex(mergedEntries: ReadonlyMap<string, SemanticTypeEntry>): Map<string, readonly string[]> {
  const topicsIndex = new Map<string, readonly string[]>();
  for (const [entryKey, entry] of mergedEntries) {
    for (const topic of entry.topics) {
      const existing = topicsIndex.get(topic);
      topicsIndex.set(topic, existing === undefined ? [entryKey] : [...existing, entryKey]);
    }
  }
  for (const [topic, keys] of topicsIndex) {
    topicsIndex.set(
      topic,
      [...keys].sort((a, b) => a.localeCompare(b))
    );
  }
  return topicsIndex;
}

/**
 * Loads, validates, and merges the supplied manifest sources into a single
 * registry suitable for the (future) `lookup-semantic-type` /
 * `search-semantic-type` MCP tools.
 *
 * Strict sources fail loud; non-strict sources fail soft. If every source
 * fails — strict or not — the loader throws, since a silent empty registry
 * provides no value to a downstream agent.
 *
 * @param input - Manifest sources plus an optional injected `readFile`
 * @returns Merged entries, topic index, deterministic warnings, and the list of source labels that loaded.
 * @throws {Error} When a strict source fails or when zero manifests load successfully.
 */
export async function loadSemanticTypeManifests(input: LoadSemanticTypeManifestsInput): Promise<LoadSemanticTypeManifestsResult> {
  const { sources, readFile = DEFAULT_READ_FILE } = input;
  const { successes, warnings } = await collectSourceOutcomes(sources, readFile);

  if (successes.length === 0) {
    throw new Error('loadSemanticTypeManifests: zero manifests loaded successfully');
  }

  const seenSources = new Map<string, string>();
  const mergedEntries = new Map<string, SemanticTypeEntry>();
  const entryProvenance = new Map<string, string>();
  const loadedSources: string[] = [];

  for (const { source, manifest } of successes) {
    mergeManifest({ source, manifest, seenSources, loadedSources, mergedEntries, entryProvenance, warnings });
  }

  const topicsIndex = buildTopicsIndex(mergedEntries);
  warnings.sort((a, b) => warningSortKey(a).localeCompare(warningSortKey(b)));

  return {
    entries: mergedEntries,
    topicsIndex,
    warnings,
    loadedSources
  };
}
