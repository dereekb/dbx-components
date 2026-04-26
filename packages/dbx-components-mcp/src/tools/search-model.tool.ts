/**
 * `dbx_model_search` tool.
 *
 * Returns ranked Firebase-model matches keyed by name, identity, modelType,
 * collection prefix, field name, and enum name. Mirrors the form
 * `dbx_form_search` weights so cross-domain calls feel symmetrical.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { FIREBASE_MODELS, type FirebaseModel } from '../registry/index.js';
import { runSearchTool, type QueryToken, type SearchHit } from './_search/score.js';
import { type DbxTool, type ToolResult } from './types.js';

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

/**
 * Scores a Firebase model against a single token.
 *
 * Weights mirror the form scorer so cross-domain results rank fairly. Most
 * signal comes from the model name, identity, and prefix — falling through to
 * field names and enum names for more speculative matches.
 *
 * @param model - the Firebase registry entry being scored
 * @param token - the lowercase token to score against
 * @returns the additive score for this token/model pair (`0` when there's no hit)
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

// MARK: Formatting
function formatSearchResults(input: { readonly query: string; readonly tokens: readonly QueryToken[]; readonly hits: readonly SearchHit<FirebaseModel>[] }): string {
  const { query, tokens, hits } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  if (hits.length === 0) {
    return [`No Firebase models matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', 'Try `dbx_model_lookup topic="models"` to browse the catalog or a broader single-word query.'].join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const model = hit.entry;
    const parent = model.parentIdentityConst ? ` · subcollection of \`${model.parentIdentityConst}\`` : '';
    lines.push(`## \`${model.name}\` · firebase model · score ${hit.score}`);
    lines.push('');
    lines.push(`- **identity:** \`${model.identityConst}\`${parent}`);
    lines.push(`- **collection:** \`${model.modelType}\` · prefix \`${model.collectionPrefix}\``);
    const enumsPart = model.enums.length > 0 ? ` · **enums:** ${model.enums.length}` : '';
    lines.push(`- **fields:** ${model.fields.length}${enumsPart}`);
    lines.push(`- **matched:** \`${hit.matchedTokens.join(', ')}\``);
    lines.push('');
    lines.push(`→ \`dbx_model_lookup topic="${model.name}"\` for full docs, or \`dbx_model_decode\` to decode a raw document.`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

// MARK: Tool
export const searchModelTool: DbxTool = {
  definition: DBX_MODEL_SEARCH_TOOL,
  run: (rawArgs) =>
    runSearchTool<FirebaseModel>(
      {
        entries: FIREBASE_MODELS,
        defaultLimit: DEFAULT_LIMIT,
        maxLimit: MAX_LIMIT,
        scoreEntry: scoreFirebaseModelAgainstToken,
        tieBreaker: (model) => model.name,
        formatResults: formatSearchResults
      },
      rawArgs
    )
};

/**
 * Tool handler for `dbx_model_search`. Tokenises the query, scores every
 * Firebase model entry, and renders the top hits with matched-token
 * annotations.
 *
 * Kept as a separately-exported function so existing spec files can call it
 * without going through the {@link DbxTool} surface.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted search results, or an error result when args fail validation
 */
export function runSearchModel(rawArgs: unknown): ToolResult {
  return searchModelTool.run(rawArgs) as ToolResult;
}
