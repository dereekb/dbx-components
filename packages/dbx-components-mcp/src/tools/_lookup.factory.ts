/**
 * Shared factory for the `dbx_*_lookup` tool family. Pipes, filters, models,
 * forms, actions, semantic types, and UI components all expose the same tool
 * shape:
 *
 *   - `topic` (string): registry slug, name, class, or the literal `'list'`
 *   - `depth` (`'brief' | 'full'`, optional): detail level for single hits
 *
 * and the same resolver chain:
 *
 *   1. `'list'` / `'catalog'` / `'all'` → catalog
 *   2. each caller-supplied resolver (slug, name, selector, class, …) in order
 *   3. fuzzy substring → "did you mean…"
 *
 * Per-domain formatters (catalog, entry, not-found) vary too much to share
 * (different field shapes, different example fences, different bullet sets);
 * they stay caller-supplied while the factory owns the parsing, resolution,
 * fuzzy scoring, and handler boilerplate.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { toolError, type DbxTool, type ToolResult } from './types.js';

/**
 * Detail levels accepted by the `depth` input. Tools render the same entry
 * differently at each level (`'brief'` shrinks single-entry output to a
 * one-liner pointer; `'full'` shows the canonical bullets and example).
 */
export type LookupDepth = 'brief' | 'full';

/**
 * Parsed and defaulted form of a lookup tool's input.
 */
export interface ParsedLookupArgs {
  readonly topic: string;
  readonly depth: LookupDepth;
}

const LOOKUP_ARGS_TYPE = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

/**
 * Validates and defaults a lookup tool's raw input. Throws when the
 * topic is missing or the depth is not one of the canonical levels.
 *
 * @param raw - the unvalidated tool arguments from the MCP runtime
 * @returns the parsed args with `depth` defaulted to `'full'`
 */
export function parseLookupArgs(raw: unknown): ParsedLookupArgs {
  const parsed = LOOKUP_ARGS_TYPE(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupArgs = {
    topic: parsed.topic,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

const CATALOG_TOPIC_KEYWORDS = new Set(['list', 'catalog', 'all']);

/**
 * Outcome of resolving a `topic` against a registry.
 */
export type LookupMatch<TEntry> = { readonly kind: 'catalog' } | { readonly kind: 'single'; readonly entry: TEntry } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly TEntry[] };

/**
 * One resolver step in the topic-resolution chain. Returns the matched
 * entry or `null`/`undefined` to signal the next resolver should try.
 *
 * The factory passes the trimmed (case-preserving) topic so resolvers can
 * do case-sensitive lookups (e.g. Angular pipe names are camelCase). The
 * `Maybe<TEntry>` return matches the existing `get*Entry*` helpers in the
 * registry data files.
 */
export type LookupResolver<TEntry> = (trimmed: string) => Maybe<TEntry>;

/**
 * Scoring contribution from a single field. Fields with `value === undefined`
 * are skipped so callers can pass through optional registry fields without
 * extra null guards.
 */
export interface FuzzyField {
  readonly value: string | undefined;
  readonly weight: number;
}

/**
 * Default cap on how many fuzzy "did you mean" candidates surface to callers.
 * Tools have always returned the top five; keep that as the shared default.
 */
const DEFAULT_FUZZY_LIMIT = 5;

/**
 * Configuration for {@link createLookupTool}.
 *
 * - `definition`: MCP tool definition (name, description, inputSchema).
 * - `entries`: registry entries in the order the catalog should render them.
 * - `resolvers`: tried in order after the catalog and exact-slug check.
 * - `fuzzyFields`: returns the weighted field set used to compute the fuzzy
 *   score for an entry.
 * - `fuzzyLimit`: optional cap on the not-found candidate list (defaults to 5).
 * - `formatCatalog`: renders the full catalog when `topic` is `'list'` /
 *   `'catalog'` / `'all'`.
 * - `formatEntry`: renders a single matched entry at the requested depth.
 * - `formatNotFound`: renders the not-found message, optionally listing fuzzy
 *   candidates.
 */
export interface LookupToolConfig<TEntry> {
  readonly definition: Tool;
  readonly entries: readonly TEntry[];
  readonly resolvers: readonly LookupResolver<TEntry>[];
  readonly fuzzyFields: (entry: TEntry) => readonly FuzzyField[];
  readonly fuzzyLimit?: number;
  readonly formatCatalog: (entries: readonly TEntry[]) => string;
  readonly formatEntry: (entry: TEntry, depth: LookupDepth) => string;
  readonly formatNotFound: (normalized: string, candidates: readonly TEntry[]) => string;
}

/**
 * Builds the `run` handler for a lookup tool. Walks the catalog → resolver
 * chain → fuzzy fallback pipeline, then dispatches to the caller-supplied
 * formatter for the matched shape.
 *
 * @param config - the lookup tool configuration
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns a `ToolResult` with the rendered markdown, or an `isError`
 *   result when `topic` cannot be resolved or args fail validation
 */
function runLookup<TEntry>(config: LookupToolConfig<TEntry>, rawArgs: unknown): ToolResult {
  let args: ParsedLookupArgs;
  try {
    args = parseLookupArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const match = resolveLookup(config, args.topic);
  let text: string;
  let isError = false;
  switch (match.kind) {
    case 'catalog':
      text = config.formatCatalog(config.entries);
      break;
    case 'single':
      text = config.formatEntry(match.entry, args.depth);
      break;
    case 'not-found':
      text = config.formatNotFound(match.normalized, match.candidates);
      isError = true;
      break;
  }
  const result: ToolResult = { content: [{ type: 'text', text }], isError };
  return result;
}

/**
 * Resolves a raw topic string against the catalog → resolver → fuzzy chain.
 *
 * @param config - the lookup tool configuration
 * @param rawTopic - the unsanitized topic string from the input
 * @returns the resolved match
 */
function resolveLookup<TEntry>(config: LookupToolConfig<TEntry>, rawTopic: string): LookupMatch<TEntry> {
  const trimmed = rawTopic.trim();
  const lowered = trimmed.toLowerCase();
  let result: LookupMatch<TEntry>;

  if (CATALOG_TOPIC_KEYWORDS.has(lowered)) {
    result = { kind: 'catalog' };
  } else {
    const hit = firstResolverHit(config.resolvers, trimmed);
    if (hit === undefined) {
      result = { kind: 'not-found', normalized: lowered, candidates: fuzzyCandidates(config, lowered) };
    } else {
      result = { kind: 'single', entry: hit };
    }
  }
  return result;
}

function firstResolverHit<TEntry>(resolvers: readonly LookupResolver<TEntry>[], trimmed: string): TEntry | undefined {
  let result: TEntry | undefined;
  for (const resolver of resolvers) {
    const hit = resolver(trimmed);
    if (hit != null) {
      result = hit;
      break;
    }
  }
  return result;
}

/**
 * Computes the top-N fuzzy candidates for a query. Each entry's score is
 * the sum of `weight` for every field whose lowercased value contains the
 * lowercased query. Entries with score 0 are dropped.
 *
 * @param config - the lookup tool configuration
 * @param query - the lowercased query (already trimmed by {@link resolveLookup})
 * @returns up to `fuzzyLimit` entries sorted descending by score
 */
function fuzzyCandidates<TEntry>(config: LookupToolConfig<TEntry>, query: string): readonly TEntry[] {
  const q = query.trim().toLowerCase();
  let result: readonly TEntry[] = [];
  if (q.length > 0) {
    const limit = config.fuzzyLimit ?? DEFAULT_FUZZY_LIMIT;
    const scored: { readonly entry: TEntry; readonly score: number }[] = [];
    for (const entry of config.entries) {
      const score = scoreEntry(config.fuzzyFields(entry), q);
      if (score > 0) {
        scored.push({ entry, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    result = scored.slice(0, limit).map((s) => s.entry);
  }
  return result;
}

function scoreEntry(fields: readonly FuzzyField[], q: string): number {
  let score = 0;
  for (const field of fields) {
    if (field.value?.toLowerCase().includes(q)) {
      score += field.weight;
    }
  }
  return score;
}

/**
 * Builds a {@link DbxTool} for the lookup family. The returned tool's
 * `run` walks the catalog → resolver → fuzzy chain and dispatches to the
 * caller-supplied formatters; the tool definition is taken verbatim.
 *
 * @param config - the lookup tool configuration
 * @returns the assembled {@link DbxTool}
 */
export function createLookupTool<TEntry>(config: LookupToolConfig<TEntry>): DbxTool {
  return {
    definition: config.definition,
    run: (rawArgs) => runLookup(config, rawArgs)
  };
}
