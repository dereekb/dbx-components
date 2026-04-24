/**
 * `dbx_search` tool.
 *
 * Returns ranked matches across the forge registry. Unlike `dbx_lookup` —
 * which resolves exactly one topic to a single entry, a tier group, or a
 * produces group — search is deliberately ranked and many-result: give it a
 * keyword (or several space-separated keywords) and it returns the top-N
 * entries scored by where the match landed (slug > factory name > produces >
 * tier > config property names > description).
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, FORGE_FIELDS, type FirebaseModel, type ForgeFieldInfo } from '../registry/index.js';
import { resolveTopicAlias } from './alias-resolver.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_SEARCH_TOOL: Tool = {
  name: 'dbx_search',
  description: [
    'Search the @dereekb/dbx-form forge registry AND the @dereekb/firebase models registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_lookup` with the slug/name or `dbx_decode` to work with a Firestore document.',
    '',
    'Query strategy:',
    '  • Space-separated tokens are ANDed (every token must contribute at least some score).',
    '  • Forge aliases resolve (e.g. "datepicker" is treated as "date").',
    '  • Results cover both forge entries (field factories / composites / primitives) and Firebase models (identity, fields, enums).',
    '',
    "Use `dbx_lookup` when you already know which slug/model you want. Use `dbx_search` to discover candidates you don't yet know about."
  ].join('\n'),
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
type SearchHit = ForgeSearchHit | FirebaseSearchHit;

interface ForgeSearchHit {
  readonly kind: 'forge';
  readonly field: ForgeFieldInfo;
  readonly score: number;
  readonly matchedTokens: readonly string[];
}

interface FirebaseSearchHit {
  readonly kind: 'firebase';
  readonly model: FirebaseModel;
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
  /** Token as the caller typed it (lowercased, trimmed). */
  readonly raw: string;
  /** Alias of `raw`; equal to `raw` when no alias exists. */
  readonly alias: string;
  /** Human-readable representation (`raw` or `raw → alias`) for output. */
  readonly display: string;
}

/**
 * Tokenizes the query into lowercase non-empty (raw, alias) pairs. Duplicates
 * are deduped on the raw form so `"date date"` collapses to one token.
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
 */
function scoreFieldAgainstToken(field: ForgeFieldInfo, token: string): number {
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

/**
 * Scores a Firebase model against a single token.
 *
 * Weights mirror the forge scorer so cross-domain results rank fairly. Most
 * signal comes from the model name, identity, and prefix — falling through to
 * field names and enum names for more speculative matches.
 */
function scoreFirebaseModelAgainstToken(model: FirebaseModel, token: string): number {
  const name = model.name.toLowerCase();
  const identity = model.identityConst.toLowerCase();
  const modelType = model.modelType.toLowerCase();
  const prefix = model.collectionPrefix.toLowerCase();

  let score = 0;
  if (name === token) {
    score += 20;
  } else if (name.startsWith(token)) {
    score += 14;
  } else if (name.includes(token)) {
    score += 8;
  }
  if (identity === token) {
    score += 12;
  } else if (identity.includes(token)) {
    score += 6;
  }
  if (modelType === token) {
    score += 10;
  } else if (modelType.includes(token)) {
    score += 4;
  }
  if (prefix === token) {
    score += 10;
  }
  for (const field of model.fields) {
    if (field.name.toLowerCase() === token) {
      score += 3;
      break;
    }
  }
  for (const en of model.enums) {
    if (en.name.toLowerCase() === token) {
      score += 5;
      break;
    }
    if (en.name.toLowerCase().includes(token)) {
      score += 2;
      break;
    }
  }
  return score;
}

function searchRegistry(tokens: readonly QueryToken[], limit: number): readonly SearchHit[] {
  if (tokens.length === 0) {
    return [];
  }
  const hits: SearchHit[] = [];
  for (const field of FORGE_FIELDS) {
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
      hits.push({ kind: 'forge', field, score: total, matchedTokens: matched });
    }
  }
  for (const model of FIREBASE_MODELS) {
    const matched: string[] = [];
    let total = 0;
    for (const token of tokens) {
      const rawScore = scoreFirebaseModelAgainstToken(model, token.raw);
      const aliasScore = token.alias === token.raw ? 0 : scoreFirebaseModelAgainstToken(model, token.alias);
      const score = Math.max(rawScore, aliasScore);
      if (score > 0) {
        total += score;
        matched.push(token.display);
      }
    }
    if (total > 0 && matched.length === tokens.length) {
      hits.push({ kind: 'firebase', model, score: total, matchedTokens: matched });
    }
  }
  hits.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) {
      return byScore;
    }
    const aKey = hitSortKey(a);
    const bKey = hitSortKey(b);
    return aKey.localeCompare(bKey);
  });
  const result = hits.slice(0, limit);
  return result;
}

function hitSortKey(hit: SearchHit): string {
  return hit.kind === 'forge' ? `a:${hit.field.slug}` : `b:${hit.model.name}`;
}

// MARK: Formatting
function formatSearchResults(query: string, tokens: readonly QueryToken[], hits: readonly SearchHit[]): string {
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  if (hits.length === 0) {
    const result = [`No results matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', 'Try `dbx_lookup topic="list"` for the forge catalog, `dbx_lookup topic="models"` for the Firebase catalog, or a broader single-word query.'].join('\n');
    return result;
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    if (hit.kind === 'forge') {
      const array = hit.field.arrayOutput === 'yes' ? ' *(array)*' : hit.field.arrayOutput === 'optional' ? ' *(single or array)*' : '';
      lines.push(`## \`${hit.field.slug}\` · forge · score ${hit.score}`);
      lines.push('');
      lines.push(`- **factory:** \`${hit.field.factoryName}\``);
      lines.push(`- **tier:** \`${hit.field.tier}\``);
      lines.push(`- **produces:** \`${hit.field.produces}\`${array}`);
      lines.push(`- **matched:** \`${hit.matchedTokens.join(', ')}\``);
      lines.push('');
      lines.push(hit.field.description);
      lines.push('');
      lines.push(`→ \`dbx_lookup topic="${hit.field.slug}"\` for full docs.`);
    } else {
      const parent = hit.model.parentIdentityConst ? ` · subcollection of \`${hit.model.parentIdentityConst}\`` : '';
      lines.push(`## \`${hit.model.name}\` · firebase model · score ${hit.score}`);
      lines.push('');
      lines.push(`- **identity:** \`${hit.model.identityConst}\`${parent}`);
      lines.push(`- **collection:** \`${hit.model.modelType}\` · prefix \`${hit.model.collectionPrefix}\``);
      lines.push(`- **fields:** ${hit.model.fields.length}${hit.model.enums.length > 0 ? ` · **enums:** ${hit.model.enums.length}` : ''}`);
      lines.push(`- **matched:** \`${hit.matchedTokens.join(', ')}\``);
      lines.push('');
      lines.push(`→ \`dbx_lookup topic="${hit.model.name}"\` for full docs, or \`dbx_decode\` to decode a raw document.`);
    }
    lines.push('');
  }
  const result = lines.join('\n').trimEnd();
  return result;
}

// MARK: Handler
export function runSearch(rawArgs: unknown): ToolResult {
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

export const searchTool: DbxTool = {
  definition: DBX_SEARCH_TOOL,
  run: runSearch
};
