/**
 * CSS-utility-class runtime registry wrapper.
 *
 * Wraps the raw {@link LoadCssUtilityManifestsResult} produced by the
 * css-utilities loader with domain-friendly accessors so
 * `dbx_css_class_lookup` does not have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any `CssUtilityEntry`
 * array via {@link createCssUtilityRegistryFromEntries} to drive the tool
 * without touching disk.
 *
 * Equivalency engine: `searchByDeclarations` parses a raw CSS declaration
 * string into a property→value map and scores every entry by Jaccard
 * (intersection / union) plus a structural-property weighting. The
 * structural set (`display`, `flex`, `flex-direction`, `align-items`,
 * `justify-content`, `gap`, `grid-template-columns`) is weighted higher
 * because matching on those usually means the same layout intent;
 * matching on padding/margin alone is rarely interesting on its own.
 */

import type { LoadCssUtilityManifestsResult } from '../manifest/css-utilities-loader.js';
import type { CssUtilityEntry } from '../manifest/css-utilities-schema.js';

// MARK: Public types
/**
 * One scored candidate produced by the equivalency search.
 */
export interface ScoredCssUtilityMatch {
  readonly entry: CssUtilityEntry;
  readonly score: number;
  readonly matchedProperties: readonly string[];
  readonly extraEntryProperties: readonly string[];
  readonly missingInputProperties: readonly string[];
}

/**
 * Optional knobs accepted by `searchByDeclarations`. `limit` defaults to 5,
 * `minScore` defaults to 0.05. Child utilities (entries with a `parent`
 * slug) are filtered out by default; pass `includeChildren: true` to
 * include them, or pass an explicit `parent` slug to scope the search to a
 * specific parent's children.
 */
export interface SearchByDeclarationsOptions {
  readonly limit?: number;
  readonly minScore?: number;
  readonly role?: string;
  readonly parent?: string;
  readonly includeChildren?: boolean;
}

/**
 * Optional knobs accepted by `findByIntent`. Mirrors the child-filter
 * semantics of {@link SearchByDeclarationsOptions}.
 */
export interface FindByIntentOptions {
  readonly role?: string;
  readonly parent?: string;
  readonly includeChildren?: boolean;
}

/**
 * Domain-friendly read API over a merged css-utility manifest set. All
 * accessors return readonly arrays sorted by `slug` so tool output stays
 * deterministic across runs.
 */
export interface CssUtilityRegistry {
  readonly all: readonly CssUtilityEntry[];
  readonly loadedSources: readonly string[];
  readonly bySource: ReadonlyMap<string, readonly CssUtilityEntry[]>;
  readonly byRole: ReadonlyMap<string, readonly CssUtilityEntry[]>;
  readonly byParent: ReadonlyMap<string, readonly CssUtilityEntry[]>;
  /**
   * Returns the first entry whose `selector` or `slug` matches the
   * supplied name. Accepts both `.dbx-flex-fill-0` and `dbx-flex-fill-0`
   * — the leading dot is normalised away.
   */
  findByName(name: string): CssUtilityEntry | undefined;
  /**
   * Returns the children registered under the supplied parent slug,
   * sorted by slug. Empty when the parent has no children (or does not
   * exist).
   */
  findChildrenOf(parent: string): readonly CssUtilityEntry[];
  /**
   * Returns scored candidates whose `intent` field contains the supplied
   * substring (case-insensitive). Children (entries with a `parent` slug)
   * are excluded by default; pass `includeChildren: true` to include them,
   * or pass an explicit `parent` slug to scope to that parent's children.
   */
  findByIntent(query: string, options?: FindByIntentOptions): readonly ScoredCssUtilityMatch[];
  /**
   * Equivalency search — parses a raw CSS declaration string into a
   * property→value map, scores every entry, returns the top-N candidates.
   * Child entries are excluded by default; see {@link SearchByDeclarationsOptions}.
   */
  searchByDeclarations(rawCss: string, options?: SearchByDeclarationsOptions): readonly ScoredCssUtilityMatch[];
}

// MARK: Internal helpers
const STRUCTURAL_PROPERTIES: ReadonlySet<string> = new Set(['display', 'flex', 'flex-direction', 'flex-wrap', 'align-items', 'align-content', 'justify-content', 'justify-items', 'gap', 'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'min-width']);

interface EntryDeclarationIndex {
  readonly entry: CssUtilityEntry;
  readonly map: ReadonlyMap<string, string>;
}

function buildEntryDeclarationIndex(entries: readonly CssUtilityEntry[]): readonly EntryDeclarationIndex[] {
  return entries.map((entry) => {
    const map = new Map<string, string>();
    for (const decl of entry.declarations) {
      // First-write wins so duplicate declarations don't break matching.
      if (!map.has(decl.property)) {
        map.set(decl.property, normalizeValue(decl.value));
      }
    }
    return { entry, map };
  });
}

function normalizeValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',');
}

/**
 * Parses a raw CSS declaration string (e.g. `"display: flex; gap: 8px;"`)
 * into a property→value map. Lowercases properties; trims and collapses
 * whitespace in values; drops empty pairs.
 *
 * @param raw - the declaration string to parse
 * @returns the parsed property→value map (lowercased keys)
 */
export function parseDeclarations(raw: string): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const segments = stripped.split(';');
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex <= 0) continue;
    const property = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = normalizeValue(trimmed.slice(colonIndex + 1));
    if (property.length === 0 || value.length === 0) continue;
    if (!result.has(property)) {
      result.set(property, value);
    }
  }
  return result;
}

interface ScoreResult {
  readonly score: number;
  readonly matched: readonly string[];
  readonly extraEntry: readonly string[];
  readonly missingInput: readonly string[];
}

function scoreAgainstEntry(input: ReadonlyMap<string, string>, entry: ReadonlyMap<string, string>): ScoreResult {
  const matched: string[] = [];
  const extraEntry: string[] = [];
  const missingInput: string[] = [];

  let weightedIntersect = 0;
  let weightedUnion = 0;

  const allProps = new Set<string>();
  for (const p of input.keys()) allProps.add(p);
  for (const p of entry.keys()) allProps.add(p);

  for (const prop of allProps) {
    const weight = STRUCTURAL_PROPERTIES.has(prop) ? 2 : 1;
    const inputValue = input.get(prop);
    const entryValue = entry.get(prop);
    if (inputValue !== undefined && entryValue !== undefined) {
      weightedUnion += weight;
      if (inputValue === entryValue) {
        weightedIntersect += weight;
        matched.push(prop);
      }
      // Same property with different values: counts in union but not intersect.
    } else if (inputValue !== undefined) {
      weightedUnion += weight;
      missingInput.push(prop);
    } else if (entryValue !== undefined) {
      weightedUnion += weight;
      extraEntry.push(prop);
    }
  }

  matched.sort((a, b) => a.localeCompare(b));
  extraEntry.sort((a, b) => a.localeCompare(b));
  missingInput.sort((a, b) => a.localeCompare(b));

  let score = weightedUnion === 0 ? 0 : weightedIntersect / weightedUnion;
  // Penalise empty input vs non-empty entry (would otherwise score 0).
  // Boost when every entry property matches (entry is a strict subset of input).
  if (matched.length === entry.size && entry.size > 0) {
    score += 0.1;
  }
  return { score, matched, extraEntry, missingInput };
}

// MARK: Construction
/**
 * Builds a {@link CssUtilityRegistry} from a loader result. Single sorted-by-
 * slug copy, plus pre-computed source/role buckets.
 *
 * @param loaded - the merged registry returned by `loadCssUtilityManifests`
 * @returns a domain-friendly read API over the merged entries
 */
export function createCssUtilityRegistry(loaded: LoadCssUtilityManifestsResult): CssUtilityRegistry {
  const entries = Array.from(loaded.entries.values());
  return createCssUtilityRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link CssUtilityRegistry} from a raw entry array. Used by tests
 * and by callers that want to drive the tool without going through the
 * loader pipeline.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list (will be sorted by slug)
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 */
export function createCssUtilityRegistryFromEntries(input: { readonly entries: readonly CssUtilityEntry[]; readonly loadedSources: readonly string[] }): CssUtilityRegistry {
  const all = [...input.entries].sort((a, b) => a.slug.localeCompare(b.slug));

  const bySource = new Map<string, CssUtilityEntry[]>();
  const byRole = new Map<string, CssUtilityEntry[]>();
  const byParent = new Map<string, CssUtilityEntry[]>();
  const byName = new Map<string, CssUtilityEntry>();

  for (const entry of all) {
    pushInto(bySource, entry.source, entry);
    pushInto(byRole, entry.role ?? 'misc', entry);
    if (entry.parent !== undefined) {
      pushInto(byParent, entry.parent, entry);
    }
    if (!byName.has(entry.selector)) {
      byName.set(entry.selector, entry);
    }
    const slugKey = entry.selector.replace(/^\./, '');
    if (!byName.has(slugKey)) {
      byName.set(slugKey, entry);
    }
    if (!byName.has(entry.slug)) {
      byName.set(entry.slug, entry);
    }
  }

  const bySourceImmutable = freezeBuckets(bySource);
  const byRoleImmutable = freezeBuckets(byRole);
  const byParentImmutable = freezeBuckets(byParent);

  const declarationIndex = buildEntryDeclarationIndex(all);

  const registry: CssUtilityRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    bySource: bySourceImmutable,
    byRole: byRoleImmutable,
    byParent: byParentImmutable,
    findByName(name) {
      const trimmed = name.trim();
      const direct = byName.get(trimmed);
      if (direct !== undefined) return direct;
      const stripped = trimmed.replace(/^\./, '');
      return byName.get(stripped);
    },
    findChildrenOf(parent) {
      return byParentImmutable.get(parent) ?? [];
    },
    findByIntent(query, options) {
      const { role, parent, includeChildren = false } = options ?? {};
      const trimmed = query.trim().toLowerCase();
      let matches: ScoredCssUtilityMatch[];
      if (trimmed.length === 0) {
        matches = [];
      } else {
        const candidates = pickCandidatePool({ all, byRole: byRoleImmutable, byParent: byParentImmutable, role, parent });
        matches = [];
        for (const entry of candidates) {
          if (!shouldIncludeEntry({ entry, parent, includeChildren })) continue;
          if (entry.intent === undefined) continue;
          const lower = entry.intent.toLowerCase();
          let score = 0;
          if (lower === trimmed) score = 10;
          else if (lower.includes(trimmed)) score = 5;
          else if (trimmed.includes(lower)) score = 3;
          if (score > 0) {
            matches.push({ entry, score, matchedProperties: [], extraEntryProperties: [], missingInputProperties: [] });
          }
        }
        matches.sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug));
      }
      return matches;
    },
    searchByDeclarations(rawCss, options) {
      const { limit = 5, minScore = 0.05, role, parent, includeChildren = false } = options ?? {};
      const inputMap = parseDeclarations(rawCss);
      let matches: ScoredCssUtilityMatch[];
      if (inputMap.size === 0) {
        matches = [];
      } else {
        const scored: ScoredCssUtilityMatch[] = [];
        for (const idx of declarationIndex) {
          if (role !== undefined && (idx.entry.role ?? 'misc') !== role) continue;
          if (parent !== undefined && idx.entry.parent !== parent) continue;
          if (!shouldIncludeEntry({ entry: idx.entry, parent, includeChildren })) continue;
          const result = scoreAgainstEntry(inputMap, idx.map);
          if (result.score >= minScore) {
            scored.push({
              entry: idx.entry,
              score: result.score,
              matchedProperties: result.matched,
              extraEntryProperties: result.extraEntry,
              missingInputProperties: result.missingInput
            });
          }
        }
        scored.sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug));
        matches = scored.slice(0, limit);
      }
      return matches;
    }
  };
  return registry;
}

interface PickCandidatePoolInput {
  readonly all: readonly CssUtilityEntry[];
  readonly byRole: ReadonlyMap<string, readonly CssUtilityEntry[]>;
  readonly byParent: ReadonlyMap<string, readonly CssUtilityEntry[]>;
  readonly role?: string;
  readonly parent?: string;
}

/**
 * Picks the candidate pool for a search call. When `parent` is set, scope
 * to that parent's children directly (the smaller set). Otherwise, fall
 * back to the role bucket if `role` is set, then the full list.
 *
 * @param input - the indexes to draw from plus optional role/parent filters
 * @returns the smallest pool consistent with the supplied filters
 */
function pickCandidatePool(input: PickCandidatePoolInput): readonly CssUtilityEntry[] {
  const { all, byRole, byParent, role, parent } = input;
  let pool: readonly CssUtilityEntry[];
  if (parent !== undefined) {
    pool = byParent.get(parent) ?? [];
  } else if (role !== undefined) {
    pool = byRole.get(role) ?? [];
  } else {
    pool = all;
  }
  return pool;
}

interface ShouldIncludeEntryInput {
  readonly entry: CssUtilityEntry;
  readonly parent: string | undefined;
  readonly includeChildren: boolean;
}

/**
 * Decides whether a given entry should appear in a search/browse result.
 * When the caller scopes to a specific `parent`, every candidate already
 * passed the parent filter upstream, so this returns `true`. Otherwise
 * children are hidden unless `includeChildren` is set.
 *
 * @param input - the entry plus the active parent / includeChildren flags
 * @returns `true` when the entry should be included in the result
 */
function shouldIncludeEntry(input: ShouldIncludeEntryInput): boolean {
  const { entry, parent, includeChildren } = input;
  let include: boolean;
  if (parent !== undefined) {
    include = true;
  } else if (includeChildren) {
    include = true;
  } else {
    include = entry.parent === undefined;
  }
  return include;
}

/**
 * Empty registry suitable as a default when the server has no manifest
 * sources to load. Tools wired against this behave like a registry that
 * loaded successfully with zero entries.
 */
export const EMPTY_CSS_UTILITY_REGISTRY: CssUtilityRegistry = createCssUtilityRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Internals
function pushInto(map: Map<string, CssUtilityEntry[]>, key: string, entry: CssUtilityEntry): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}

function freezeBuckets(map: Map<string, CssUtilityEntry[]>): ReadonlyMap<string, readonly CssUtilityEntry[]> {
  const out = new Map<string, readonly CssUtilityEntry[]>();
  for (const [key, list] of map) {
    out.set(key, [...list]);
  }
  return out;
}
