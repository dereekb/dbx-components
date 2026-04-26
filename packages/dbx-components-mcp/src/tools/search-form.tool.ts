/**
 * `dbx_form_search` tool.
 *
 * Returns ranked matches across the form registry. Unlike `dbx_form_lookup` —
 * which resolves exactly one topic to a single entry, a tier group, or a
 * produces group — search is deliberately ranked and many-result: give it a
 * keyword (or several space-separated keywords) and it returns the top-N
 * form entries scored by where the match landed (slug > factory name >
 * produces > tier > config property names > description).
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FORM_FIELDS, type FormFieldInfo } from '../registry/index.js';
import { resolveTopicAlias } from './form-alias-resolver.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_FORM_SEARCH_TOOL: Tool = {
  name: 'dbx_form_search',
  description: ['Search the @dereekb/dbx-form registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_form_lookup` with the slug/name.', '', 'Query strategy:', '  • Space-separated tokens are ANDed (every token must contribute at least some score).', '  • Form aliases resolve (e.g. "datepicker" is treated as "date").', '', "Use `dbx_form_lookup` when you already know which slug you want. Use `dbx_form_search` to discover candidates you don't yet know about."].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'One or more space-separated keywords.'
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
const SearchArgsType = type({
  query: 'string',
  'limit?': 'number'
});

interface ParsedSearchArgs {
  readonly query: string;
  readonly limit: number;
}

function parseSearchArgs(raw: unknown): ParsedSearchArgs {
  const parsed = SearchArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const rawLimit = parsed.limit ?? DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(rawLimit)));
  const result: ParsedSearchArgs = { query: parsed.query, limit };
  return result;
}

// MARK: Scoring
interface FormSearchHit {
  readonly field: FormFieldInfo;
  readonly score: number;
  readonly matchedTokens: readonly string[];
}

/**
 * A query token kept together with its aliased form. Each token scores as
 * `max(score(raw), score(alias))` against every field — this way an alias
 * that hits a single slug exactly doesn't exclude the many other entries
 * whose slugs legitimately contain the raw token as a substring.
 */
interface QueryToken {
  /**
   * Token as the caller typed it (lowercased, trimmed).
   */
  readonly raw: string;
  /**
   * Alias of `raw`; equal to `raw` when no alias exists.
   */
  readonly alias: string;
  /**
   * Human-readable representation (`raw` or `raw → alias`) for output.
   */
  readonly display: string;
}

/**
 * Tokenizes the query into lowercase non-empty (raw, alias) pairs. Duplicates
 * are deduped on the raw form so `"date date"` collapses to one token.
 *
 * @param query - the raw multi-word search query
 * @returns the unique token pairs in original-query order
 */
function tokenize(query: string): readonly QueryToken[] {
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
    const alias = resolveTopicAlias(token);
    const display = alias === token ? token : `${token} → ${alias}`;
    result.push({ raw: token, alias, display });
  }
  return result;
}

/**
 * Scores a single field against a single token. Weights are deliberately
 * spaced so stacked hits can't fabricate a higher score than the next-better
 * match kind.
 *
 * @param field - the form registry entry being scored
 * @param token - the lowercase token to score against
 * @returns the additive score for this token/field pair (`0` when there's no hit)
 */
function scoreFieldAgainstToken(field: FormFieldInfo, token: string): number {
  const slug = field.slug.toLowerCase();
  const factory = field.factoryName.toLowerCase();
  const produces = field.produces.toLowerCase();
  const tier = field.tier.toLowerCase();
  const description = field.description.toLowerCase();

  let score = 0;
  if (slug === token) {
    score += 20;
  } else if (slug.startsWith(token)) {
    score += 14;
  } else if (slug.includes(token)) {
    score += 8;
  }
  if (factory === token || factory === `dbxforge${token}field`) {
    score += 12;
  } else if (factory.includes(token)) {
    score += 6;
  }
  if (produces === token) {
    score += 10;
  } else if (produces.includes(token)) {
    score += 4;
  }
  if (tier === token) {
    score += 5;
  }
  for (const key of Object.keys(field.config)) {
    const keyLower = key.toLowerCase();
    if (keyLower === token) {
      score += 4;
      break;
    }
    if (keyLower.includes(token)) {
      score += 2;
      break;
    }
  }
  if (score === 0 && description.includes(token)) {
    score += 1;
  }
  return score;
}

function searchRegistry(tokens: readonly QueryToken[], limit: number): readonly FormSearchHit[] {
  if (tokens.length === 0) {
    return [];
  }
  const hits: FormSearchHit[] = [];
  for (const field of FORM_FIELDS) {
    const matched: string[] = [];
    let total = 0;
    for (const token of tokens) {
      const rawScore = scoreFieldAgainstToken(field, token.raw);
      const aliasScore = token.alias === token.raw ? 0 : scoreFieldAgainstToken(field, token.alias);
      const score = Math.max(rawScore, aliasScore);
      if (score > 0) {
        total += score;
        matched.push(token.display);
      }
    }
    // AND semantics: require every token to contribute SOMETHING, otherwise
    // single-word dominant hits would drown multi-word disambiguation.
    if (total > 0 && matched.length === tokens.length) {
      hits.push({ field, score: total, matchedTokens: matched });
    }
  }
  hits.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) {
      return byScore;
    }
    return a.field.slug.localeCompare(b.field.slug);
  });
  return hits.slice(0, limit);
}

// MARK: Formatting
function formatSearchResults(query: string, tokens: readonly QueryToken[], hits: readonly FormSearchHit[]): string {
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  if (hits.length === 0) {
    return [`No form entries matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', 'Try `dbx_form_lookup topic="list"` for the form catalog or a broader single-word query.'].join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const array = hit.field.arrayOutput === 'yes' ? ' *(array)*' : hit.field.arrayOutput === 'optional' ? ' *(single or array)*' : '';
    lines.push(`## \`${hit.field.slug}\` · form · score ${hit.score}`);
    lines.push('');
    lines.push(`- **factory:** \`${hit.field.factoryName}\``);
    lines.push(`- **tier:** \`${hit.field.tier}\``);
    lines.push(`- **produces:** \`${hit.field.produces}\`${array}`);
    lines.push(`- **matched:** \`${hit.matchedTokens.join(', ')}\``);
    lines.push('');
    lines.push(hit.field.description);
    lines.push('');
    lines.push(`→ \`dbx_form_lookup topic="${hit.field.slug}"\` for full docs.`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

// MARK: Handler
/**
 * Tool handler for `dbx_form_search`. Tokenises the query, scores every form
 * registry entry, and renders the top hits with matched-token annotations.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted search results, or an error result when args fail validation
 */
export function runSearchForm(rawArgs: unknown): ToolResult {
  let args: ParsedSearchArgs;
  try {
    args = parseSearchArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }
  const tokens = tokenize(args.query);
  const hits = searchRegistry(tokens, args.limit);
  const text = formatSearchResults(args.query, tokens, hits);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const searchFormTool: DbxTool = {
  definition: DBX_FORM_SEARCH_TOOL,
  run: runSearchForm
};
