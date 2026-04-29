/**
 * Rule-catalog lookup helpers consumed by `dbx_explain_rule`.
 *
 * `findRule(code)` is the primary entry point — exact match by code.
 * `searchRules(query)` is the fallback used when an unknown code
 * resolves nothing; it ranks substring matches against code, title,
 * and source so misremembered codes ("STORAGEFILE_GROUPIDS_MISSING")
 * still surface the canonical entry.
 */

import { RULE_CATALOG } from '../../../generated/rule-catalog.generated.js';
import type { RuleEntry } from './types.js';

/**
 * Returns the catalog entry whose `code` exactly equals `code`. Comparison is
 * case-insensitive — the catalog stores SCREAMING_SNAKE strings, so callers
 * passing a lowercased copy still resolve.
 *
 * @param code - the rule code to look up
 * @returns the matching entry, or `undefined` when no rule has that code
 */
export function findRule(code: string): RuleEntry | undefined {
  const target = code.trim().toUpperCase();
  return RULE_CATALOG.find((entry) => entry.code.toUpperCase() === target);
}

interface SearchHit {
  readonly entry: RuleEntry;
  readonly score: number;
}

/**
 * Ranks every catalog entry against `query` and returns the top
 * `limit` hits. Used as a fallback by `dbx_explain_rule` when an
 * exact-code lookup fails. Scoring is intentionally simple — the
 * data set is ~200 entries so a linear scan is plenty.
 *
 * Token rules:
 *  - Each whitespace-separated token must contribute at least once
 *    (AND semantics) — otherwise the candidate is dropped.
 *  - Code matches outscore title matches outscore source matches.
 *
 * @param query - the free-form search query
 * @param limit - max results to return; defaults to 5
 * @returns the highest-scoring catalog entries, descending
 */
export function searchRules(query: string, limit = 5): readonly RuleEntry[] {
  // Split on whitespace AND underscore — codes are SCREAMING_SNAKE, so a
  // typo'd word in a misremembered code still surfaces nearby matches.
  const tokens = query
    .toLowerCase()
    .split(/[\s_]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const entry of RULE_CATALOG) {
    const score = scoreEntry(entry, tokens, true);
    if (score === undefined) continue;
    hits.push({ entry, score });
  }
  // Fallback: when strict AND filtering returns nothing, relax to OR
  // semantics so a typo in any one token still surfaces neighbours.
  if (hits.length === 0) {
    for (const entry of RULE_CATALOG) {
      const score = scoreEntry(entry, tokens, false);
      if (score === undefined || score === 0) continue;
      hits.push({ entry, score });
    }
  }
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.code.localeCompare(b.entry.code);
  });
  return hits.slice(0, limit).map((h) => h.entry);
}

/**
 * Scores one catalog entry against a set of lowercased tokens.
 *
 * When `requireAll` is true (the default first pass) every token must
 * contribute or the entry is dropped — that's the "exact-ish match"
 * behaviour. When false (the OR fallback) the score is the sum of
 * token contributions and a zero return drops the entry.
 *
 * @param entry - the catalog entry to score
 * @param tokens - whitespace/underscore-separated query tokens, lowercased
 * @param requireAll - whether every token must contribute
 * @returns the additive score, or `undefined` to drop the entry
 */
function scoreEntry(entry: RuleEntry, tokens: readonly string[], requireAll: boolean): number | undefined {
  const code = entry.code.toLowerCase();
  const title = entry.title.toLowerCase();
  const source = entry.source.toLowerCase();
  let total = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    if (code === token) tokenScore += 30;
    else if (code.includes(token)) tokenScore += 14;
    if (title.includes(token)) tokenScore += 6;
    if (source.includes(token)) tokenScore += 2;
    if (tokenScore === 0 && requireAll) return undefined;
    total += tokenScore;
  }
  return total;
}
