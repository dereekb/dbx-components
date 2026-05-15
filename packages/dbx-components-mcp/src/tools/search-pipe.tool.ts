/**
 * `dbx_pipe_search` tool factory.
 *
 * Returns ranked matches across the Angular pipe registry. Unlike
 * `dbx_pipe_lookup` — which resolves exactly one topic — search is
 * deliberately ranked and many-result: pass a keyword (or several
 * space-separated keywords) and it returns the top-N entries scored by
 * where the match landed (slug > pipeName > className > category >
 * input/output type > description).
 *
 * Reads from a {@link PipeRegistry} supplied at construction time.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PipeEntryInfo, PipeRegistry } from '../registry/pipes-runtime.js';
import { runSearchTool, type QueryToken, type SearchHit } from './_search/score.js';
import { type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_PIPE_SEARCH_TOOL: Tool = {
  name: 'dbx_pipe_search',
  description: [
    'Search the @dereekb/dbx-core Angular pipe registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_pipe_lookup` with the slug or pipe name.',
    '',
    'Query strategy:',
    '  • Space-separated tokens are ANDed (every token must contribute at least some score).',
    '  • Token matches the pipe slug, Angular pipe name, class name, category, input/output type, related slugs, or description (in roughly that priority order).',
    '',
    'Use `dbx_pipe_lookup` when you already know which pipe you want. Use `dbx_pipe_search` to discover candidates you don\'t yet know about (e.g. "distance", "currency", "observable").'
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

// MARK: Scoring
function scoreSlug(slug: string, token: string): number {
  let score = 0;
  if (slug === token) {
    score = 20;
  } else if (slug.startsWith(token)) {
    score = 14;
  } else if (slug.includes(token)) {
    score = 8;
  }
  return score;
}

function scorePipeName(pipeName: string, token: string): number {
  let score = 0;
  if (pipeName === token) {
    score = 18;
  } else if (pipeName.startsWith(token)) {
    score = 12;
  } else if (pipeName.includes(token)) {
    score = 6;
  }
  return score;
}

function scoreClassName(className: string, token: string): number {
  let score = 0;
  if (className === token) {
    score = 10;
  } else if (className.includes(token)) {
    score = 4;
  }
  return score;
}

function scoreTypeFragment(typeText: string, token: string): number {
  return typeText.includes(token) ? 3 : 0;
}

/**
 * Scores a single pipe entry against a single token. Weights are spaced so
 * stacked partial hits can't out-rank a clean exact match on the slug or
 * pipe name.
 *
 * Weights:
 *   slug exact: 20 / starts-with: 14 / includes: 8
 *   pipeName exact: 18 / starts-with: 12 / includes: 6
 *   className exact: 10 / includes: 4
 *   category exact: 5
 *   inputType / outputType includes: 3 each
 *   relatedSlugs membership: 2
 *   description includes (fallback): 1
 *
 * @param entry - the pipe registry entry being scored
 * @param token - the lowercase token to score against
 * @returns the additive score for this token/entry pair (`0` when there's no hit)
 */
function scoreEntryAgainstToken(entry: PipeEntryInfo, token: string): number {
  const slug = entry.slug.toLowerCase();
  const pipeName = entry.pipeName.toLowerCase();
  const className = entry.className.toLowerCase();
  const inputType = entry.inputType.toLowerCase();
  const outputType = entry.outputType.toLowerCase();
  const description = entry.description.toLowerCase();
  const relatedSlugs = entry.relatedSlugs.map((s) => s.toLowerCase());

  let score = scoreSlug(slug, token);
  score += scorePipeName(pipeName, token);
  score += scoreClassName(className, token);
  if (entry.category === token) {
    score += 5;
  }
  score += scoreTypeFragment(inputType, token);
  score += scoreTypeFragment(outputType, token);
  if (relatedSlugs.includes(token)) {
    score += 2;
  }
  if (score === 0 && description.includes(token)) {
    score += 1;
  }
  return score;
}

// MARK: Formatting
function formatSearchResults(input: { readonly query: string; readonly tokens: readonly QueryToken[]; readonly hits: readonly SearchHit<PipeEntryInfo>[] }): string {
  const { query, tokens, hits } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  if (hits.length === 0) {
    return [`No pipes matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', 'Try `dbx_pipe_lookup topic="list"` for the pipe catalog or a broader single-word query.'].join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const entry = hit.entry;
    lines.push(`## \`${entry.slug}\` · ${entry.category} · score ${hit.score}`, '', `- **pipe:** \`${entry.pipeName}\``, `- **class:** \`${entry.className}\``, `- **input:** \`${entry.inputType}\``, `- **output:** \`${entry.outputType}\``, `- **matched:** \`${hit.matchedTokens.join(', ')}\``, '', entry.description, '', `→ \`dbx_pipe_lookup topic="${entry.slug}"\` for full docs.`, '');
  }
  return lines.join('\n').trimEnd();
}

// MARK: Factory
/**
 * Configuration for {@link createSearchPipeTool}.
 */
export interface CreateSearchPipeToolConfig {
  readonly registry: PipeRegistry;
}

/**
 * Builds the `dbx_pipe_search` tool against a pipe registry. Called by
 * {@link registerTools} once the registry has loaded at server startup.
 *
 * @param config - the registry the tool should rank against
 * @returns a registered {@link DbxTool} ready to add to the dispatch table
 * @__NO_SIDE_EFFECTS__
 */
export function createSearchPipeTool(config: CreateSearchPipeToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    return runSearchTool<PipeEntryInfo>(
      {
        entries: registry.all,
        defaultLimit: DEFAULT_LIMIT,
        maxLimit: MAX_LIMIT,
        scoreEntry: scoreEntryAgainstToken,
        tieBreaker: (entry) => entry.slug,
        formatResults: formatSearchResults
      },
      rawArgs
    );
  }

  const tool: DbxTool = {
    definition: DBX_PIPE_SEARCH_TOOL,
    run
  };
  return tool;
}
