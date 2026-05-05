/**
 * Tokens runtime registry wrapper.
 *
 * Wraps the raw {@link LoadTokenManifestsResult} produced by the tokens
 * loader with domain-friendly accessors so `dbx_css_token_lookup` and
 * `dbx_ui_smell_check` don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any `TokenEntry` array via
 * {@link createTokenRegistryFromEntries} to drive the tools without
 * touching disk.
 */

import type { LoadTokenManifestsResult } from '../manifest/tokens-loader.js';
import type { TokenEntry } from '../manifest/tokens-schema.js';

// MARK: Public types
/**
 * One scored candidate produced by the registry's intent / value matching
 * helpers. `score` is a non-normalised non-negative number — higher means
 * more confident — that the calling tool uses for top-N truncation and
 * cross-resolver tie-breaking.
 */
export interface ScoredTokenMatch {
  readonly entry: TokenEntry;
  readonly score: number;
}

/**
 * Domain-friendly read API over a merged token-manifest set. All accessors
 * return readonly arrays sorted by `cssVariable` so tool output stays
 * deterministic across runs.
 */
export interface TokenRegistry {
  readonly all: readonly TokenEntry[];
  readonly loadedSources: readonly string[];
  readonly bySource: ReadonlyMap<string, readonly TokenEntry[]>;
  readonly byRole: ReadonlyMap<string, readonly TokenEntry[]>;
  /**
   * Returns the first entry whose `cssVariable` matches `name` (case-sensitive
   * — CSS custom property names are case-sensitive).
   */
  findByCssVariable(name: string): TokenEntry | undefined;
  /**
   * Returns the first entry whose `scssVariable` matches `name`.
   */
  findByScssVariable(name: string): TokenEntry | undefined;
  /**
   * Returns scored candidates whose `intents[]` array contains a string that
   * matches `query` (case-insensitive substring). Optional `role` filter
   * narrows the candidate pool before scoring.
   */
  findByIntent(query: string, role?: string): readonly ScoredTokenMatch[];
  /**
   * Returns scored candidates whose `defaults.{light,dark}` matches the
   * supplied raw CSS value via the substring-match fallback. Tools with
   * domain-specific value parsing (OKLCH color distance, length tolerance,
   * shadow layers) implement their own scoring on top of `all`.
   */
  findByValue(value: string, role?: string): readonly ScoredTokenMatch[];
  /**
   * Returns every entry whose `componentScope` matches the supplied
   * Angular Material slug exactly (e.g. `mat-progress-bar`).
   */
  findByComponent(component: string): readonly TokenEntry[];
}

// MARK: Construction
/**
 * Builds a {@link TokenRegistry} from a loader result. The wrapper keeps a
 * single sorted-by-`cssVariable` copy of every entry plus pre-computed
 * source / role buckets so each lookup is O(n) at worst and subsequent
 * calls hit the cached bucket lists.
 *
 * @param loaded - the merged registry returned by `loadTokenManifests`
 * @returns a domain-friendly read API over the merged entries
 */
export function createTokenRegistry(loaded: LoadTokenManifestsResult): TokenRegistry {
  const entries = Array.from(loaded.entries.values()).sort((a, b) => a.cssVariable.localeCompare(b.cssVariable));
  return createTokenRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link TokenRegistry} from a raw entry array. Used by tests and
 * by callers that want to drive the tools without going through the loader
 * pipeline.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list (will be sorted by cssVariable)
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 */
export function createTokenRegistryFromEntries(input: { readonly entries: readonly TokenEntry[]; readonly loadedSources: readonly string[] }): TokenRegistry {
  const all = [...input.entries].sort((a, b) => a.cssVariable.localeCompare(b.cssVariable));

  const bySource = new Map<string, TokenEntry[]>();
  const byRole = new Map<string, TokenEntry[]>();
  const byCssVariable = new Map<string, TokenEntry>();
  const byScssVariable = new Map<string, TokenEntry>();
  const byComponent = new Map<string, TokenEntry[]>();

  for (const entry of all) {
    pushInto(bySource, entry.source, entry);
    pushInto(byRole, entry.role, entry);
    if (!byCssVariable.has(entry.cssVariable)) {
      byCssVariable.set(entry.cssVariable, entry);
    }
    if (entry.scssVariable !== undefined && !byScssVariable.has(entry.scssVariable)) {
      byScssVariable.set(entry.scssVariable, entry);
    }
    if (entry.componentScope !== undefined) {
      pushInto(byComponent, entry.componentScope, entry);
    }
  }

  const bySourceImmutable = freezeBuckets(bySource);
  const byRoleImmutable = freezeBuckets(byRole);

  const registry: TokenRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    bySource: bySourceImmutable,
    byRole: byRoleImmutable,
    findByCssVariable(name) {
      return byCssVariable.get(name);
    },
    findByScssVariable(name) {
      return byScssVariable.get(name);
    },
    findByIntent(query, role) {
      const trimmed = query.trim().toLowerCase();
      let matches: ScoredTokenMatch[];
      if (trimmed.length === 0) {
        matches = [];
      } else {
        const candidates = role === undefined ? all : (byRoleImmutable.get(role) ?? []);
        matches = scoreEntriesByIntent(candidates, trimmed);
      }
      return matches;
    },
    findByValue(value, role) {
      const trimmed = value.trim();
      let matches: ScoredTokenMatch[];
      if (trimmed.length === 0) {
        matches = [];
      } else {
        const candidates = role === undefined ? all : (byRoleImmutable.get(role) ?? []);
        matches = scoreEntriesByValue(candidates, trimmed);
      }
      return matches;
    },
    findByComponent(component) {
      return byComponent.get(component) ?? [];
    }
  };
  return registry;
}

/**
 * Empty registry suitable as a default when the server has no manifest
 * sources to load. Tools wired against this behave like a registry that
 * loaded successfully with zero entries.
 */
export const EMPTY_TOKEN_REGISTRY: TokenRegistry = createTokenRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Internals
function scoreEntriesByIntent(candidates: readonly TokenEntry[], trimmed: string): ScoredTokenMatch[] {
  const matches: ScoredTokenMatch[] = [];
  for (const entry of candidates) {
    const best = bestIntentScore(entry.intents, trimmed);
    if (best > 0) {
      matches.push({ entry, score: best });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

function bestIntentScore(intents: readonly string[], trimmed: string): number {
  let best = 0;
  for (const intent of intents) {
    const lower = intent.toLowerCase();
    let score = 0;
    if (lower === trimmed) {
      score = 10;
    } else if (lower.includes(trimmed)) {
      score = 5;
    } else if (trimmed.includes(lower) && lower.length > 0) {
      score = 3;
    }
    if (score > best) best = score;
  }
  return best;
}

function scoreEntriesByValue(candidates: readonly TokenEntry[], trimmed: string): ScoredTokenMatch[] {
  const matches: ScoredTokenMatch[] = [];
  for (const entry of candidates) {
    const score = scoreEntryByValue(entry, trimmed);
    if (score > 0) {
      matches.push({ entry, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

function scoreEntryByValue(entry: TokenEntry, trimmed: string): number {
  let score = 0;
  if (entry.defaults.light !== undefined && entry.defaults.light === trimmed) score = 10;
  if (entry.defaults.dark !== undefined && entry.defaults.dark === trimmed && score < 10) score = 9;
  if (score === 0 && entry.defaults.light?.includes(trimmed)) score = 4;
  if (score === 0 && entry.defaults.dark?.includes(trimmed)) score = 3;
  return score;
}

function pushInto(map: Map<string, TokenEntry[]>, key: string, entry: TokenEntry): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}

function freezeBuckets(map: Map<string, TokenEntry[]>): ReadonlyMap<string, readonly TokenEntry[]> {
  const out = new Map<string, readonly TokenEntry[]>();
  for (const [key, list] of map) {
    out.set(key, [...list]);
  }
  return out;
}
