/**
 * `dbx_form_search` tool factory.
 *
 * Returns ranked matches across the form registry. Unlike `dbx_form_lookup` —
 * which resolves exactly one topic to a single entry, a tier group, or a
 * produces group — search is deliberately ranked and many-result: give it a
 * keyword (or several space-separated keywords) and it returns the top-N
 * form entries scored by where the match landed (slug > factory name >
 * produces > tier > config property names > description).
 *
 * Built from a {@link ForgeFieldRegistry} loaded at server startup.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type FormFieldInfo } from '../registry/index.js';
import type { ForgeFieldRegistry } from '../registry/forge-fields.js';
import { resolveTopicAlias } from './form-alias-resolver.js';
import { runSearchTool, type QueryToken, type SearchHit } from './_search/score.js';
import { type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_FORM_SEARCH_TOOL: Tool = {
  name: 'dbx_form_search',
  description: [
    'Search the @dereekb/dbx-form registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_form_lookup` with the slug/name.',
    '',
    'Tiers covered: `field-factory`, `field-derivative`, `composite-builder`, `template-builder`, `primitive`.',
    '',
    'Query strategy:',
    '  • Space-separated tokens are ANDed (every token must contribute at least some score).',
    '  • Form aliases resolve (e.g. "datepicker" is treated as "date").',
    '',
    "Use `dbx_form_lookup` when you already know which slug you want. Use `dbx_form_search` to discover candidates you don't yet know about."
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

// MARK: Formatting
function formatSearchResults(input: { readonly query: string; readonly tokens: readonly QueryToken[]; readonly hits: readonly SearchHit<FormFieldInfo>[] }): string {
  const { query, tokens, hits } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  if (hits.length === 0) {
    return [`No form entries matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', 'Try `dbx_form_lookup topic="list"` for the form catalog or a broader single-word query.'].join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const field = hit.entry;
    const optionalArray = field.arrayOutput === 'optional' ? ' *(single or array)*' : '';
    const array = field.arrayOutput === 'yes' ? ' *(array)*' : optionalArray;
    lines.push(`## \`${field.slug}\` · form · score ${hit.score}`, '', `- **factory:** \`${field.factoryName}\``, `- **tier:** \`${field.tier}\``, `- **produces:** \`${field.produces}\`${array}`, `- **matched:** \`${hit.matchedTokens.join(', ')}\``, '', field.description, '', `→ \`dbx_form_lookup topic="${field.slug}"\` for full docs.`, '');
  }
  return lines.join('\n').trimEnd();
}

// MARK: Factory
/**
 * Configuration for {@link createSearchFormTool}.
 */
export interface CreateSearchFormToolConfig {
  readonly registry: ForgeFieldRegistry;
}

/**
 * Builds the `dbx_form_search` tool against a forge-fields registry. Called by
 * {@link registerTools} once the registry has loaded at server startup.
 *
 * @param config - the registry the tool should rank against
 * @returns a registered {@link DbxTool} ready to add to the dispatch table
 */
export function createSearchFormTool(config: CreateSearchFormToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    return runSearchTool<FormFieldInfo>(
      {
        entries: registry.all,
        defaultLimit: DEFAULT_LIMIT,
        maxLimit: MAX_LIMIT,
        aliasResolver: resolveTopicAlias,
        scoreEntry: scoreFieldAgainstToken,
        tieBreaker: (field) => field.slug,
        formatResults: formatSearchResults
      },
      rawArgs
    );
  }

  const tool: DbxTool = {
    definition: DBX_FORM_SEARCH_TOOL,
    run
  };
  return tool;
}
