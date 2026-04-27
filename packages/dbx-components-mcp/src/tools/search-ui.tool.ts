/**
 * `dbx_ui_search` tool.
 *
 * Returns ranked matches across the UI components registry. Unlike
 * `dbx_ui_lookup` — which resolves exactly one topic — search is deliberately
 * ranked and many-result: give it a keyword (or several space-separated
 * keywords) and it returns the top-N entries scored by where the match landed
 * (slug > selector > className > description token > relatedSlugs).
 *
 * Optional `category` arg restricts scoring to a single UI category.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { UI_CATEGORY_ORDER, UI_COMPONENTS, getUiComponentsByCategory, type UiComponentCategory, type UiComponentInfo } from '../registry/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_UI_SEARCH_TOOL: Tool = {
  name: 'dbx_ui_search',
  description: [
    'Search the @dereekb/dbx-web UI components registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_ui_lookup` with the slug or selector.',
    '',
    'Query strategy:',
    '  • Space-separated tokens are ANDed (every token must contribute at least some score).',
    '  • Pass `category` to scope to one UI category (`layout`, `list`, `button`, `card`, `feedback`, `overlay`, `navigation`, `text`, `screen`, `action`, `router`).',
    '',
    "Use `dbx_ui_lookup` when you already know which slug or selector you want. Use `dbx_ui_search` to discover candidates you don't yet know about."
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'One or more space-separated keywords.'
      },
      category: {
        type: 'string',
        enum: [...UI_CATEGORY_ORDER],
        description: 'Optional category filter — restricts the search corpus to one UI category.'
      },
      limit: {
        type: 'number',
        description: `Maximum number of results to return. Defaults to ${DEFAULT_LIMIT}, capped at ${MAX_LIMIT}.`,
        minimum: 1,
        maximum: MAX_LIMIT,
        default: DEFAULT_LIMIT
      }
    },
    required: ['query']
  }
};

// MARK: Input validation
const SearchUiArgsType = type({
  query: 'string',
  'category?': "'layout' | 'list' | 'button' | 'card' | 'feedback' | 'overlay' | 'navigation' | 'text' | 'screen' | 'action' | 'router' | 'misc'",
  'limit?': 'number'
});

interface ParsedSearchUiArgs {
  readonly query: string;
  readonly category: UiComponentCategory | undefined;
  readonly limit: number;
}

function parseSearchUiArgs(raw: unknown): ParsedSearchUiArgs {
  const parsed = SearchUiArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const rawLimit = parsed.limit ?? DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(rawLimit)));
  const result: ParsedSearchUiArgs = {
    query: parsed.query,
    category: parsed.category,
    limit
  };
  return result;
}

// MARK: Scoring
interface UiSearchHit {
  readonly entry: UiComponentInfo;
  readonly score: number;
  readonly matchedTokens: readonly string[];
}

/**
 * Tokenizes the query into lowercase non-empty tokens. Duplicates collapse.
 *
 * @param query - the raw multi-word search query
 * @returns the unique tokens in original-query order
 */
function tokenize(query: string): readonly string[] {
  const raw = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw) {
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    result.push(token);
  }
  return result;
}

function scoreSlug(slug: string, token: string): number {
  let score: number;
  if (slug === token) {
    score = 20;
  } else if (slug.startsWith(token)) {
    score = 14;
  } else if (slug.includes(token)) {
    score = 8;
  } else {
    score = 0;
  }
  return score;
}

function scoreSelectorPieces(selectorPieces: readonly string[], token: string): number {
  let score = 0;
  for (const piece of selectorPieces) {
    if (piece === token) {
      score = 12;
      break;
    }
  }
  if (score === 0) {
    for (const piece of selectorPieces) {
      if (piece.includes(token)) {
        score = 5;
        break;
      }
    }
  }
  return score;
}

function scoreClassName(className: string, token: string): number {
  let score: number;
  if (className === token) {
    score = 10;
  } else if (className.includes(token)) {
    score = 4;
  } else {
    score = 0;
  }
  return score;
}

/**
 * Scores a single entry against a single token. Weights are spaced so stacked
 * substring hits can't fabricate a higher score than a clean exact match.
 *
 * Weights:
 *   slug exact: 20 / starts-with: 14 / includes: 8
 *   selector exact (per token piece): 12 / includes: 5
 *   className exact: 10 / includes: 4
 *   category exact: 6
 *   relatedSlugs membership: 2
 *   description includes: 1
 *
 * @param entry - the UI registry entry being scored
 * @param token - the lowercase token to score against
 * @returns the additive score for this token/entry pair (`0` when there's no hit)
 */
function scoreEntryAgainstToken(entry: UiComponentInfo, token: string): number {
  const slug = entry.slug.toLowerCase();
  const className = entry.className.toLowerCase();
  const selectorPieces = entry.selector
    .toLowerCase()
    .split(',')
    .map((s) => s.trim());
  const description = entry.description.toLowerCase();
  const relatedSlugsLower = entry.relatedSlugs.map((s) => s.toLowerCase());

  let score = scoreSlug(slug, token);
  score += scoreSelectorPieces(selectorPieces, token);
  score += scoreClassName(className, token);
  if (entry.category === token) {
    score += 6;
  }
  if (relatedSlugsLower.includes(token)) {
    score += 2;
  }
  if (score === 0 && description.includes(token)) {
    score += 1;
  }
  return score;
}

function searchRegistry(corpus: readonly UiComponentInfo[], tokens: readonly string[], limit: number): readonly UiSearchHit[] {
  let result: readonly UiSearchHit[] = [];
  if (tokens.length > 0) {
    const hits: UiSearchHit[] = [];
    for (const entry of corpus) {
      const matched: string[] = [];
      let total = 0;
      for (const token of tokens) {
        const score = scoreEntryAgainstToken(entry, token);
        if (score > 0) {
          total += score;
          matched.push(token);
        }
      }
      if (total > 0 && matched.length === tokens.length) {
        hits.push({ entry, score: total, matchedTokens: matched });
      }
    }
    hits.sort((a, b) => {
      const byScore = b.score - a.score;
      if (byScore !== 0) {
        return byScore;
      }
      return a.entry.slug.localeCompare(b.entry.slug);
    });
    result = hits.slice(0, limit);
  }
  return result;
}

/**
 * Options for formatting UI search results as markdown.
 */
interface FormatSearchResultsOptions {
  readonly query: string;
  readonly tokens: readonly string[];
  readonly hits: readonly UiSearchHit[];
  readonly category: UiComponentCategory | undefined;
}

// MARK: Formatting
function formatSearchResults(options: FormatSearchResultsOptions): string {
  const { query, tokens, hits, category } = options;
  const tokenDisplay = tokens.join(', ');
  const scopeLabel = category ? ` · category=\`${category}\`` : '';
  let result: string;
  if (hits.length === 0) {
    result = [`No UI components matched \`${query}\` (tokens: \`${tokenDisplay}\`${scopeLabel}).`, '', 'Try `dbx_ui_lookup topic="list"` for the UI catalog or a broader single-word query.'].join('\n');
  } else {
    const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\`${scopeLabel} · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
    for (const hit of hits) {
      lines.push(`## \`${hit.entry.slug}\` · ${hit.entry.category} · score ${hit.score}`, '', `- **class:** \`${hit.entry.className}\``, `- **kind:** \`${hit.entry.kind}\``, `- **selector:** \`${hit.entry.selector}\``, `- **matched:** \`${hit.matchedTokens.join(', ')}\``, '', hit.entry.description, '', `→ \`dbx_ui_lookup topic="${hit.entry.slug}"\` for full docs.`, '');
    }
    result = lines.join('\n').trimEnd();
  }
  return result;
}

// MARK: Handler
/**
 * Tool handler for `dbx_ui_search`. Tokenises the query, scores every UI
 * registry entry, and renders the top hits with matched-token annotations.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted search results, or an error result when args fail validation
 */
export function runSearchUi(rawArgs: unknown): ToolResult {
  let args: ParsedSearchUiArgs;
  try {
    args = parseSearchUiArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }
  const tokens = tokenize(args.query);
  const corpus = args.category ? getUiComponentsByCategory(args.category) : UI_COMPONENTS;
  const hits = searchRegistry(corpus, tokens, args.limit);
  const text = formatSearchResults({ query: args.query, tokens, hits, category: args.category });
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const searchUiTool: DbxTool = {
  definition: DBX_UI_SEARCH_TOOL,
  run: runSearchUi
};
