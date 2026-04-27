/**
 * Loader for actions manifests.
 *
 * Reads one or more manifest files, validates them against
 * {@link ActionManifest}, and merges them into a single lookup-ready
 * registry. Mirrors the pipes / forge-fields / ui-components loaders.
 */

import { readFile as nodeReadFile } from 'node:fs/promises';
import { type } from 'arktype';
import { ActionManifest, type ActionEntry } from './actions-schema.js';

// MARK: Public types
/**
 * One manifest the loader is asked to ingest. `path` must be absolute.
 */
export interface ActionManifestSource {
  readonly origin: 'bundled' | 'external';
  readonly path: string;
  readonly strict?: boolean;
}

/**
 * Function shape used by the loader to read manifest contents.
 */
export type ActionManifestReadFile = (absolutePath: string) => Promise<string>;

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

/**
 * Discriminated union of all non-fatal events the loader emits.
 */
export type ActionLoaderWarning =
  | { readonly kind: 'manifest-missing'; readonly path: string }
  | { readonly kind: 'manifest-parse-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-schema-failed'; readonly path: string; readonly error: string }
  | { readonly kind: 'manifest-version-unsupported'; readonly path: string; readonly version: unknown }
  | { readonly kind: 'source-label-collision'; readonly source: string; readonly existingPath: string; readonly droppedPath: string }
  | { readonly kind: 'entry-collision'; readonly entryKey: string; readonly winningSource: string; readonly losingSource: string };

// MARK: Internal types
type LoadFromSourceResult = { readonly kind: 'success'; readonly manifest: ActionManifest } | { readonly kind: 'failure'; readonly warning: ActionLoaderWarning };

const DEFAULT_READ_FILE: ActionManifestReadFile = (path) => nodeReadFile(path, 'utf-8');
const SUPPORTED_VERSION = 1;

// MARK: Source loading
async function loadFromSource(source: ActionManifestSource, readFile: ActionManifestReadFile): Promise<LoadFromSourceResult> {
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
        const validated = ActionManifest(parsed);
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

function isStrictSource(source: ActionManifestSource): boolean {
  return source.strict ?? source.origin === 'bundled';
}

// MARK: Warning ordering
function warningSortKey(warning: ActionLoaderWarning): string {
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
 * registry suitable for the `dbx_action_lookup` MCP tool.
 *
 * @param input - manifest sources plus an optional injected `readFile`
 * @returns merged entries, role index, deterministic warnings, and the list of source labels that loaded
 * @throws when a strict source fails or when zero manifests load successfully
 */
export async function loadActionManifests(input: LoadActionManifestsInput): Promise<LoadActionManifestsResult> {
  const { sources, readFile = DEFAULT_READ_FILE } = input;
  const successes: { readonly source: ActionManifestSource; readonly manifest: ActionManifest }[] = [];
  const warnings: ActionLoaderWarning[] = [];

  for (const source of sources) {
    const outcome = await loadFromSource(source, readFile);
    if (outcome.kind === 'success') {
      successes.push({ source, manifest: outcome.manifest });
    } else if (isStrictSource(source)) {
      throw new Error(`loadActionManifests: strict source failed (${outcome.warning.kind}): ${source.path}`);
    } else {
      warnings.push(outcome.warning);
    }
  }

  if (successes.length === 0) {
    throw new Error('loadActionManifests: zero manifests loaded successfully');
  }

  const seenSources = new Map<string, string>();
  const mergedEntries = new Map<string, ActionEntry>();
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
      const entryKey = `${manifest.module}::${entry.slug}`;
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

  const roleIndex = new Map<string, readonly string[]>();
  for (const [entryKey, entry] of mergedEntries) {
    const existing = roleIndex.get(entry.role);
    if (existing === undefined) {
      roleIndex.set(entry.role, [entryKey]);
    } else {
      roleIndex.set(entry.role, [...existing, entryKey]);
    }
  }
  for (const [role, keys] of roleIndex) {
    roleIndex.set(
      role,
      [...keys].sort((a, b) => a.localeCompare(b))
    );
  }

  warnings.sort((a, b) => warningSortKey(a).localeCompare(warningSortKey(b)));

  return {
    entries: mergedEntries,
    roleIndex,
    warnings,
    loadedSources
  };
}
