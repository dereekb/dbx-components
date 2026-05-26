/**
 * Shared building blocks for the "catalog-style" `dbx_*_search` tools — the
 * family that scores every entry against name / slug / tags / category /
 * description / param-name and renders the hits as a markdown report with
 * module, category, subpath, signature, and a lookup-command footer.
 *
 * Each catalog-style tool (`dbx_util_search`, `dbx_model_snapshot_field_search`,
 * …) has the same scoring weights, the same `query`/`limit`/`category`/`module`
 * inputSchema, and the same per-hit markdown shape; only the entity label,
 * the lookup command name, and the optional extra schema filters (e.g.
 * `optional` for snapshot fields) vary. Lifting the shared scaffolding here
 * keeps the per-tool files focused on those differences instead of repeating
 * the boilerplate.
 *
 * Tools that need bespoke scoring weights (e.g. `dbx_model_firebase_index_search`
 * which adds model + collection fields with different exact/starts/includes
 * weights) keep their own local scorers; this module is only for the canonical
 * pattern.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type QueryToken, type SearchHit } from './score.js';

// MARK: Shared limits
/**
 * Default `limit` returned by a catalog-style search tool when the caller
 * omits one. Mirrored by `MAX_CATALOG_LIMIT` as the upper bound.
 */
export const DEFAULT_CATALOG_LIMIT = 10;
/**
 * Upper bound on the catalog search `limit` argument; values above this
 * clamp down in `parseSearchArgs`.
 */
export const MAX_CATALOG_LIMIT = 25;

// MARK: Scorable entry shape
/**
 * Minimal entry shape every catalog-style scorer needs. Per-domain entry
 * types (`UtilEntryInfo`, `ModelSnapshotFieldEntryInfo`, …) satisfy this
 * structurally.
 */
export interface CatalogScorableEntry {
  readonly name: string;
  readonly slug: string;
  readonly category: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly params: readonly { readonly name: string }[];
}

// MARK: Per-field scoring
/**
 * Scores a name match. Weights: exact=10, prefix=7, substring=5.
 *
 * @param name - The lowercased entry name.
 * @param token - The lowercased query token.
 * @returns The additive score for this token-name pair (`0` when there's no hit).
 */
export function scoreCatalogNameToken(name: string, token: string): number {
  let score = 0;
  if (name === token) {
    score = 10;
  } else if (name.startsWith(token)) {
    score = 7;
  } else if (name.includes(token)) {
    score = 5;
  }
  return score;
}

/**
 * Scores a slug match. Weights: exact=9, prefix=6, substring=4.
 *
 * @param slug - The lowercased entry slug.
 * @param token - The lowercased query token.
 * @returns The additive score for this token-slug pair (`0` when there's no hit).
 */
export function scoreCatalogSlugToken(slug: string, token: string): number {
  let score = 0;
  if (slug === token) {
    score = 9;
  } else if (slug.startsWith(token)) {
    score = 6;
  } else if (slug.includes(token)) {
    score = 4;
  }
  return score;
}

/**
 * Scores the best tag match across `tags`. Weights: exact=8, substring=4.
 *
 * @param tags - The entry's tag list (any casing).
 * @param token - The lowercased query token.
 * @returns The best per-tag score for this token (`0` when no tag matched).
 */
export function scoreCatalogTagsToken(tags: readonly string[], token: string): number {
  let best = 0;
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === token) {
      best = Math.max(best, 8);
    } else if (tagLower.includes(token)) {
      best = Math.max(best, 4);
    }
  }
  return best;
}

/**
 * Scores a fallback match against parameter names. Returns `1` on the first
 * substring hit, otherwise `0`. Intended as a low-weight tiebreaker when the
 * higher-weight fields don't match.
 *
 * @param params - The entry's parameter list.
 * @param token - The lowercased query token.
 * @returns `1` when any param name includes the token, otherwise `0`.
 */
export function scoreCatalogParamsToken(params: readonly { readonly name: string }[], token: string): number {
  let score = 0;
  for (const param of params) {
    if (param.name.toLowerCase().includes(token)) {
      score = 1;
      break;
    }
  }
  return score;
}

/**
 * Canonical catalog-entry scorer. Combines the name / slug / tags scorers
 * additively, layers in a category-equality boost, falls back to a
 * description-substring bonus, then a param-name tiebreaker when nothing
 * else matched. Weights are deliberately spaced so stacked partial hits
 * can't fabricate a higher score than the next-better match kind.
 *
 * @param entry - The catalog entry being scored.
 * @param token - The lowercased query token.
 * @returns The additive score for this token-entry pair (`0` when there's no hit).
 */
export function scoreCatalogEntryToken<TEntry extends CatalogScorableEntry>(entry: TEntry, token: string): number {
  const name = entry.name.toLowerCase();
  const slug = entry.slug.toLowerCase();
  const category = entry.category.toLowerCase();
  const description = entry.description.toLowerCase();

  let score = scoreCatalogNameToken(name, token) + scoreCatalogSlugToken(slug, token) + scoreCatalogTagsToken(entry.tags, token);

  if (category === token) {
    score += 3;
  }
  if (score === 0 && description.includes(token)) {
    score += 2;
  }
  if (score === 0) {
    score += scoreCatalogParamsToken(entry.params, token);
  }
  return score;
}

// MARK: Input schema
/**
 * Standard catalog-search input-schema property block. Tools that need
 * additional filters merge their own properties in via
 * {@link buildCatalogSearchInputSchema}.
 */
const CATALOG_BASE_SCHEMA_PROPERTIES: Record<string, object> = {
  query: {
    type: 'string',
    description: 'One or more space-separated keywords.'
  },
  limit: {
    type: 'number',
    description: `Maximum number of results to return. Defaults to ${DEFAULT_CATALOG_LIMIT}, capped at ${MAX_CATALOG_LIMIT}.`,
    minimum: 1,
    maximum: MAX_CATALOG_LIMIT,
    default: DEFAULT_CATALOG_LIMIT
  },
  category: {
    type: 'string',
    description: 'Optional category filter. Narrows the candidate pool before scoring.'
  },
  module: {
    type: 'string',
    description: 'Optional module filter (e.g. "@dereekb/util"). Narrows the candidate pool before scoring.'
  }
};

/**
 * Optional overrides accepted by {@link buildCatalogSearchInputSchema}.
 */
export interface BuildCatalogSearchInputSchemaInput {
  /**
   * Property descriptions that replace the canonical text — tools that want
   * domain-specific examples on `category` / `module` pass overrides here.
   */
  readonly descriptions?: { readonly category?: string; readonly module?: string };
  /**
   * Extra schema properties merged after the standard `query`/`limit`/
   * `category`/`module` block (e.g. `optional` for the snapshot-field tool).
   */
  readonly extraProperties?: Record<string, object>;
}

/**
 * Builds the standard catalog-search `inputSchema`. Includes `query`
 * (required), `limit`, `category`, `module`; plus any `extraProperties`.
 *
 * @param input - Optional description overrides and extra properties.
 * @returns A JSON-Schema object suitable for `Tool['inputSchema']`.
 */
export function buildCatalogSearchInputSchema(input?: BuildCatalogSearchInputSchemaInput): Tool['inputSchema'] {
  const properties: Record<string, object> = { ...CATALOG_BASE_SCHEMA_PROPERTIES };
  const overrides = input?.descriptions;
  if (overrides?.category !== undefined) {
    properties.category = { ...(properties.category as Record<string, unknown>), description: overrides.category };
  }
  if (overrides?.module !== undefined) {
    properties.module = { ...(properties.module as Record<string, unknown>), description: overrides.module };
  }
  const extras = input?.extraProperties;
  if (extras !== undefined) {
    for (const [key, value] of Object.entries(extras)) {
      properties[key] = value;
    }
  }
  return {
    type: 'object',
    properties,
    required: ['query']
  };
}

// MARK: Result formatting
/**
 * One displayable filter in the report header. `value === undefined` filters
 * are skipped so the formatter can accept the entire arg block without
 * pre-filtering.
 */
export interface CatalogSearchFilter {
  readonly key: string;
  readonly value: string | number | boolean | undefined;
}

/**
 * Per-hit display options. `headerBadge` (e.g. `' · optional'`) is appended
 * after the `kind` token in the `## ...` header line.
 */
export interface CatalogHitDisplayOptions {
  readonly headerBadge?: string;
  readonly lookupTool: string;
}

/**
 * Per-hit data the catalog formatter renders. Per-domain entries that carry
 * additional fields (e.g. `optional` on snapshot-field) project them into
 * `headerBadge` via the per-tool wrapper.
 */
export interface CatalogHitEntry {
  readonly slug: string;
  readonly name: string;
  readonly kind: string;
  readonly module: string;
  readonly category: string;
  readonly subpath: string;
  readonly signature: string;
  readonly description: string;
  readonly tags: readonly string[];
}

/**
 * Renders one search hit into the canonical catalog markdown block.
 *
 * @param input - The hit and per-domain display options.
 * @param input.hit - The ranked hit to render.
 * @param input.options - Per-domain display options (header badge, lookup tool name).
 * @returns Markdown lines for the hit (caller joins with `\n`).
 */
export function formatCatalogHit<TEntry extends CatalogHitEntry>(input: { readonly hit: SearchHit<TEntry>; readonly options: CatalogHitDisplayOptions }): readonly string[] {
  const { hit, options } = input;
  const entry = hit.entry;
  const tagBadges = entry.tags
    .slice(0, 8)
    .map((t) => '`' + t + '`')
    .join(', ');
  const tagDisplay = entry.tags.length > 0 ? `\n- **tags:** ${tagBadges}` : '';
  const badge = options.headerBadge ?? '';
  return [`## \`${entry.slug}\` · \`${entry.name}\` · ${entry.kind}${badge} · score ${hit.score}`, '', `- **module:** \`${entry.module}\``, `- **category:** \`${entry.category}\``, `- **subpath:** \`${entry.subpath}\``, `- **signature:** \`${entry.signature}\``, `- **matched:** \`${hit.matchedTokens.join(', ')}\`${tagDisplay}`, '', entry.description.split('\n')[0], '', `→ \`${options.lookupTool} topic="${entry.slug}"\` for full docs.`, ''];
}

/**
 * Input to {@link formatCatalogSearchResults}.
 */
export interface FormatCatalogSearchResultsInput<TEntry extends CatalogHitEntry> {
  /**
   * The original query string.
   */
  readonly query: string;
  /**
   * The tokenized query (output of `tokenize`).
   */
  readonly tokens: readonly QueryToken[];
  /**
   * Ranked, already-limited search hits.
   */
  readonly hits: readonly SearchHit<TEntry>[];
  /**
   * Filter `{ key, value }` pairs; `value === undefined` entries are skipped.
   */
  readonly filters: readonly CatalogSearchFilter[];
  /**
   * The entity name used in the empty-result line (e.g. `"utility entries"`).
   */
  readonly entityLabel: string;
  /**
   * Trailing hint sentence used in the empty-result branch.
   */
  readonly emptyHint: string;
  /**
   * Per-hit display options. Pass a function to derive options from each
   * hit (e.g. snapshot-field's `optional` header badge).
   */
  readonly hitOptions: CatalogHitDisplayOptions | ((hit: SearchHit<TEntry>) => CatalogHitDisplayOptions);
}

/**
 * Renders the standard catalog-search markdown report (header + filter
 * suffix + per-hit blocks, or empty-result message). Per-domain tools call
 * this from their `formatResults` so they only retain the entity label,
 * hint text, and any per-hit badge logic.
 *
 * @param input - The render input.
 * @returns The markdown report.
 */
export function formatCatalogSearchResults<TEntry extends CatalogHitEntry>(input: FormatCatalogSearchResultsInput<TEntry>): string {
  const { query, tokens, hits, filters, entityLabel, emptyHint, hitOptions } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  const filterSuffix = buildFilterSuffix(filters);

  let result: string;
  if (hits.length === 0) {
    result = [`No ${entityLabel} matched \`${query}\`${filterSuffix} (tokens: \`${tokenDisplay}\`).`, '', emptyHint].join('\n');
  } else {
    const headerLines = [`# Search: \`${query}\`${filterSuffix}`, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
    const hitLines = renderCatalogHits<TEntry>(hits, hitOptions);
    result = [...headerLines, ...hitLines].join('\n').trimEnd();
  }
  return result;
}

function buildFilterSuffix(filters: readonly CatalogSearchFilter[]): string {
  const filterParts: string[] = [];
  for (const { key, value } of filters) {
    if (value !== undefined) {
      filterParts.push(`${key}=\`${value}\``);
    }
  }
  return filterParts.length > 0 ? ` (filters: ${filterParts.join(', ')})` : '';
}

function renderCatalogHits<TEntry extends CatalogHitEntry>(hits: ReadonlyArray<SearchHit<TEntry>>, hitOptions: CatalogHitDisplayOptions | ((hit: SearchHit<TEntry>) => CatalogHitDisplayOptions)): readonly string[] {
  const lines: string[] = [];
  for (const hit of hits) {
    const options = typeof hitOptions === 'function' ? hitOptions(hit) : hitOptions;
    for (const line of formatCatalogHit<TEntry>({ hit, options })) {
      lines.push(line);
    }
  }
  return lines;
}
