/**
 * Shared infrastructure for the `dbx_*_search` tool family. Form and model
 * search both:
 *
 *   - accept `query` (string, ANDed across whitespace-separated tokens) and
 *     `limit` (number, capped at a domain MAX_LIMIT)
 *   - tokenize, dedupe, optionally alias-resolve
 *   - score every registry entry against every token
 *   - require AND semantics (every token must contribute > 0 to be a hit)
 *   - sort by descending score with a domain-specific stable tie-breaker
 *   - slice to the limit, then render
 *
 * Per-domain shape — the entry type, the scoring weights, the tie-breaker
 * key, the catalog rendering — varies enough to remain caller-supplied; the
 * helpers here own the rest.
 */

import { type } from 'arktype';
import { toolError, type ToolResult } from '../types.js';

const SEARCH_ARGS_TYPE = type({
  query: 'string',
  'limit?': 'number'
});

/**
 * Parsed and clamped form of a search tool's input.
 */
export interface ParsedSearchArgs {
  readonly query: string;
  readonly limit: number;
}

/**
 * Validates and clamps a search tool's raw input. Throws when the query is
 * missing.
 *
 * @param raw - the unvalidated tool arguments from the MCP runtime
 * @param config - the domain's default/max limit pair
 * @param config.defaultLimit - applied when `limit` is omitted from `raw`
 * @param config.maxLimit - upper bound; values above this clamp down
 * @returns the parsed args with `limit` clamped to `[1, maxLimit]`
 */
export function parseSearchArgs(raw: unknown, config: { readonly defaultLimit: number; readonly maxLimit: number }): ParsedSearchArgs {
  const parsed = SEARCH_ARGS_TYPE(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const rawLimit = parsed.limit ?? config.defaultLimit;
  const limit = Math.max(1, Math.min(config.maxLimit, Math.trunc(rawLimit)));
  const result: ParsedSearchArgs = { query: parsed.query, limit };
  return result;
}

/**
 * One tokenized query word. `display` is what the formatter shows back to
 * the caller (`raw → alias` when an alias resolved, otherwise just `raw`);
 * `raw` and `alias` are what the scorer compares against entries.
 */
export interface QueryToken {
  /**
   * The token as the caller typed it, lowercased and trimmed.
   */
  readonly raw: string;
  /**
   * Aliased form of `raw`. Equal to `raw` when no alias applies.
   */
  readonly alias: string;
  /**
   * Human-readable representation for reports (`raw` or `raw → alias`).
   */
  readonly display: string;
}

/**
 * Splits a query string into deduped, lowercased tokens. When an
 * `aliasResolver` is supplied, each token is paired with its alias and the
 * scorer evaluates `max(score(raw), score(alias))` — the form domain uses
 * this so `"datepicker"` tokens both alias-match `date` slugs and substring-
 * match unrelated entries.
 *
 * @param query - the raw multi-word search query
 * @param aliasResolver - optional `(token) => alias-or-same-token`
 * @returns the unique tokens in original-query order
 */
export function tokenize(query: string, aliasResolver?: (token: string) => string): readonly QueryToken[] {
  const raw = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const result: QueryToken[] = [];
  for (const token of raw) {
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    const alias = aliasResolver ? aliasResolver(token) : token;
    const display = alias === token ? token : `${token} → ${alias}`;
    result.push({ raw: token, alias, display });
  }
  return result;
}

/**
 * Single ranked search hit. The shared {@link runSearchTool} returns these
 * before passing them to the per-domain formatter, so domain hit types can
 * be derived simply by aliasing `SearchHit<TEntry>`.
 */
export interface SearchHit<TEntry> {
  readonly entry: TEntry;
  readonly score: number;
  readonly matchedTokens: readonly string[];
}

/**
 * Scores every entry against every token using AND semantics: an entry is a
 * hit only if every token contributes > 0. The score is summed; the
 * matched-token display strings (`token` or `token → alias`) are accumulated
 * for the formatter.
 *
 * @param config - the per-domain scoring configuration
 * @param config.entries - the registry entries to score
 * @param config.tokens - the parsed query tokens
 * @param config.scoreFn - per-(entry, raw-token) scorer; called twice when an
 *   alias exists (once for raw, once for alias) and the larger score is taken
 * @param config.tieBreaker - extracts the lexicographic tie-breaker key
 * @returns hits in descending score order, ties broken by the `tieBreaker`
 *   value (string, lexicographic)
 */
export function searchEntries<TEntry>(config: { readonly entries: readonly TEntry[]; readonly tokens: readonly QueryToken[]; readonly scoreFn: (entry: TEntry, token: string) => number; readonly tieBreaker: (entry: TEntry) => string }): readonly SearchHit<TEntry>[] {
  const { entries, tokens, scoreFn, tieBreaker } = config;
  let result: readonly SearchHit<TEntry>[] = [];
  if (tokens.length > 0) {
    const hits: SearchHit<TEntry>[] = [];
    for (const entry of entries) {
      const matched: string[] = [];
      let total = 0;
      for (const token of tokens) {
        const rawScore = scoreFn(entry, token.raw);
        const aliasScore = token.alias === token.raw ? 0 : scoreFn(entry, token.alias);
        const score = Math.max(rawScore, aliasScore);
        if (score > 0) {
          total += score;
          matched.push(token.display);
        }
      }
      // AND semantics: every token must contribute, so single-word dominant
      // hits don't drown multi-word disambiguation.
      if (total > 0 && matched.length === tokens.length) {
        hits.push({ entry, score: total, matchedTokens: matched });
      }
    }
    hits.sort((a, b) => {
      const byScore = b.score - a.score;
      let cmp: number;
      if (byScore !== 0) {
        cmp = byScore;
      } else {
        cmp = tieBreaker(a.entry).localeCompare(tieBreaker(b.entry));
      }
      return cmp;
    });
    result = hits;
  }
  return result;
}

/**
 * Configuration for {@link runSearchTool}.
 */
export interface SearchToolConfig<TEntry> {
  readonly entries: readonly TEntry[];
  readonly defaultLimit: number;
  readonly maxLimit: number;
  /**
   * Optional alias resolver (form search uses this; model search does not).
   */
  readonly aliasResolver?: (token: string) => string;
  /**
   * Per-(entry, token) scorer. Called once per (raw, alias) pair; the larger
   * score wins.
   */
  readonly scoreEntry: (entry: TEntry, token: string) => number;
  /**
   * Stable tie-breaker — typically the entry's slug or canonical name.
   */
  readonly tieBreaker: (entry: TEntry) => string;
  /**
   * Renders the final report. Receives the raw query, the parsed tokens, and
   * the limited hit list (already trimmed to `args.limit`).
   */
  readonly formatResults: (input: { readonly query: string; readonly tokens: readonly QueryToken[]; readonly hits: readonly SearchHit<TEntry>[] }) => string;
}

/**
 * Runs the shared search pipeline: parse args → tokenize → score → sort →
 * limit → format. Returns the rendered markdown wrapped in a `ToolResult`,
 * or an `isError` result when the args fail validation.
 *
 * @param config - the search tool configuration
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the search tool result
 */
export function runSearchTool<TEntry>(config: SearchToolConfig<TEntry>, rawArgs: unknown): ToolResult {
  let args: ParsedSearchArgs;
  try {
    args = parseSearchArgs(rawArgs, { defaultLimit: config.defaultLimit, maxLimit: config.maxLimit });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }
  const tokens = tokenize(args.query, config.aliasResolver);
  const ranked = searchEntries<TEntry>({ entries: config.entries, tokens, scoreFn: config.scoreEntry, tieBreaker: config.tieBreaker });
  const hits = ranked.slice(0, args.limit);
  const text = config.formatResults({ query: args.query, tokens, hits });
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}
