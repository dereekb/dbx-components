/**
 * `dbx_model_search` tool.
 *
 * Returns ranked Firebase-model matches keyed by name, identity, modelType,
 * collection prefix, field name, and enum name. Mirrors the form
 * `dbx_form_search` weights so cross-domain calls feel symmetrical.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, type FirebaseModel } from '../registry/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_MODEL_SEARCH_TOOL: Tool = {
  name: 'dbx_model_search',
  description: ['Search the @dereekb/firebase models registry by keyword(s). Returns ranked Firebase models — pick one, then call `dbx_model_lookup` with the model name or `dbx_model_decode` to work with a Firestore document.', '', 'Query strategy:', '  • Space-separated tokens are ANDed (every token must contribute at least some score).', '  • Matches model name, identity const, modelType, collection prefix, fields, and enums.'].join('\n'),
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
interface FirebaseSearchHit {
  readonly model: FirebaseModel;
  readonly score: number;
  readonly matchedTokens: readonly string[];
}

interface QueryToken {
  readonly raw: string;
  readonly display: string;
}

/**
 * Tokenizes the query into lowercase non-empty tokens. Duplicates are deduped.
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
    result.push({ raw: token, display: token });
  }
  return result;
}

/**
 * Scores a Firebase model against a single token.
 *
 * Weights mirror the form scorer so cross-domain results rank fairly. Most
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

function searchRegistry(tokens: readonly QueryToken[], limit: number): readonly FirebaseSearchHit[] {
  if (tokens.length === 0) {
    return [];
  }
  const hits: FirebaseSearchHit[] = [];
  for (const model of FIREBASE_MODELS) {
    const matched: string[] = [];
    let total = 0;
    for (const token of tokens) {
      const score = scoreFirebaseModelAgainstToken(model, token.raw);
      if (score > 0) {
        total += score;
        matched.push(token.display);
      }
    }
    if (total > 0 && matched.length === tokens.length) {
      hits.push({ model, score: total, matchedTokens: matched });
    }
  }
  hits.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) {
      return byScore;
    }
    return a.model.name.localeCompare(b.model.name);
  });
  const result = hits.slice(0, limit);
  return result;
}

// MARK: Formatting
function formatSearchResults(query: string, tokens: readonly QueryToken[], hits: readonly FirebaseSearchHit[]): string {
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  if (hits.length === 0) {
    const result = [`No Firebase models matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', 'Try `dbx_model_lookup topic="models"` to browse the catalog or a broader single-word query.'].join('\n');
    return result;
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const parent = hit.model.parentIdentityConst ? ` · subcollection of \`${hit.model.parentIdentityConst}\`` : '';
    lines.push(`## \`${hit.model.name}\` · firebase model · score ${hit.score}`);
    lines.push('');
    lines.push(`- **identity:** \`${hit.model.identityConst}\`${parent}`);
    lines.push(`- **collection:** \`${hit.model.modelType}\` · prefix \`${hit.model.collectionPrefix}\``);
    lines.push(`- **fields:** ${hit.model.fields.length}${hit.model.enums.length > 0 ? ` · **enums:** ${hit.model.enums.length}` : ''}`);
    lines.push(`- **matched:** \`${hit.matchedTokens.join(', ')}\``);
    lines.push('');
    lines.push(`→ \`dbx_model_lookup topic="${hit.model.name}"\` for full docs, or \`dbx_model_decode\` to decode a raw document.`);
    lines.push('');
  }
  const result = lines.join('\n').trimEnd();
  return result;
}

// MARK: Handler
export function runSearchModel(rawArgs: unknown): ToolResult {
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

export const searchModelTool: DbxTool = {
  definition: DBX_MODEL_SEARCH_TOOL,
  run: runSearchModel
};
