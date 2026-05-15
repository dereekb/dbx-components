/**
 * `dbx_action_search` tool factory.
 *
 * Returns ranked matches across the action registry (directives, store,
 * state-machine members). Unlike `dbx_action_lookup` — which resolves
 * exactly one topic — search is deliberately ranked and many-result: pass a
 * keyword (or several space-separated keywords) and it returns the top-N
 * entries scored by where the match landed (slug > className > selector >
 * state value > description).
 *
 * Reads from an {@link ActionRegistry} supplied at construction time.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { ACTION_ROLE_ORDER, type ActionEntryInfo, type ActionEntryRole, type ActionRegistry } from '../registry/actions-runtime.js';
import { runSearchTool, type QueryToken, type SearchHit } from './_search/score.js';
import { type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_ACTION_SEARCH_TOOL: Tool = {
  name: 'dbx_action_search',
  description: [
    'Search the @dereekb/dbx-core action registry (directives, store, `DbxActionState` enum) by keyword(s). Returns ranked candidates — pick one, then call `dbx_action_lookup` with the slug or selector.',
    '',
    'Query strategy:',
    '  • Space-separated tokens are ANDed (every token must contribute at least some score).',
    "  • Pass `role` to scope to one role (`'directive'`, `'store'`, `'state'`).",
    '  • Token matches the slug, class name, directive selector, state member name, related skills, or description (in roughly that priority order).',
    '',
    'Use `dbx_action_lookup` when you already know which slug or selector you want. Use `dbx_action_search` to discover candidates you don\'t yet know about (e.g. "trigger", "success", "working").'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'One or more space-separated keywords.'
      },
      role: {
        type: 'string',
        enum: [...ACTION_ROLE_ORDER],
        description: "Optional role filter — restricts the search corpus to `'directive'`, `'store'`, or `'state'`."
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

function scoreClassName(className: string, token: string): number {
  let score = 0;
  if (className === token) {
    score = 12;
  } else if (className.includes(token)) {
    score = 5;
  }
  return score;
}

function scoreSelectorPieces(selectorPieces: readonly string[], token: string): number {
  let score = 0;
  for (const piece of selectorPieces) {
    if (piece === token) {
      score = 14;
      break;
    }
  }
  if (score === 0) {
    for (const piece of selectorPieces) {
      if (piece.includes(token)) {
        score = 6;
        break;
      }
    }
  }
  return score;
}

function scoreStateValue(stateValue: string, token: string): number {
  let score = 0;
  if (stateValue === token) {
    score = 16;
  } else if (stateValue.includes(token)) {
    score = 7;
  }
  return score;
}

/**
 * Scores a single action entry against a single token. Weights are spaced so
 * stacked partial hits can't out-rank a clean exact match.
 *
 * Weights (where applicable to the entry's role):
 *   slug exact: 20 / starts-with: 14 / includes: 8
 *   selector exact (per token piece): 14 / includes: 6 (directives only)
 *   className exact: 12 / includes: 5 (directives + stores)
 *   state value exact: 16 / includes: 7 (state members)
 *   role exact: 4
 *   skillRefs membership: 2
 *   description includes (fallback): 1
 *
 * @param entry - the action registry entry being scored
 * @param token - the lowercase token to score against
 * @returns the additive score for this token/entry pair (`0` when there's no hit)
 */
function scoreEntryAgainstToken(entry: ActionEntryInfo, token: string): number {
  const slug = entry.slug.toLowerCase();
  const description = entry.description.toLowerCase();
  const skillRefs = entry.skillRefs.map((s) => s.toLowerCase());

  let score = scoreSlug(slug, token);
  if (entry.role === 'directive') {
    const selectorPieces = entry.selector
      .toLowerCase()
      .split(',')
      .map((s) => s.trim());
    score += scoreSelectorPieces(selectorPieces, token);
    score += scoreClassName(entry.className.toLowerCase(), token);
  } else if (entry.role === 'store') {
    score += scoreClassName(entry.className.toLowerCase(), token);
  } else {
    score += scoreStateValue(entry.stateValue.toLowerCase(), token);
  }
  if (entry.role === token) {
    score += 4;
  }
  if (skillRefs.includes(token)) {
    score += 2;
  }
  if (score === 0 && description.includes(token)) {
    score += 1;
  }
  return score;
}

// MARK: Formatting
const ROLE_LABEL: Record<ActionEntryRole, string> = {
  directive: 'directive',
  store: 'store',
  state: 'state'
};

function formatEntryHeader(entry: ActionEntryInfo): string {
  let head: string;
  switch (entry.role) {
    case 'directive':
      head = `- **class:** \`${entry.className}\`\n- **selector:** \`${entry.selector}\``;
      break;
    case 'store':
      head = `- **class:** \`${entry.className}\``;
      break;
    case 'state':
      head = `- **state:** \`${entry.stateValue}\``;
      break;
  }
  return head;
}

function formatSearchResults(input: { readonly query: string; readonly tokens: readonly QueryToken[]; readonly hits: readonly SearchHit<ActionEntryInfo>[] }): string {
  const { query, tokens, hits } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  if (hits.length === 0) {
    return [`No action entries matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', 'Try `dbx_action_lookup topic="list"` for the action catalog or a broader single-word query.'].join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const entry = hit.entry;
    lines.push(`## \`${entry.slug}\` · ${ROLE_LABEL[entry.role]} · score ${hit.score}`, '', formatEntryHeader(entry), `- **matched:** \`${hit.matchedTokens.join(', ')}\``, '', entry.description, '', `→ \`dbx_action_lookup topic="${entry.slug}"\` for full docs.`, '');
  }
  return lines.join('\n').trimEnd();
}

// MARK: Factory
/**
 * Configuration for {@link createSearchActionTool}.
 */
export interface CreateSearchActionToolConfig {
  readonly registry: ActionRegistry;
}

/**
 * Builds the `dbx_action_search` tool against an action registry. Called by
 * {@link registerTools} once the registry has loaded at server startup.
 *
 * @param config - the registry the tool should rank against
 * @returns a registered {@link DbxTool} ready to add to the dispatch table
 * @__NO_SIDE_EFFECTS__
 */
export function createSearchActionTool(config: CreateSearchActionToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    let role: ActionEntryRole | undefined;
    if (rawArgs !== null && typeof rawArgs === 'object' && 'role' in rawArgs) {
      const candidate = (rawArgs as { readonly role?: unknown }).role;
      if (typeof candidate === 'string' && (ACTION_ROLE_ORDER as readonly string[]).includes(candidate)) {
        role = candidate as ActionEntryRole;
      }
    }
    const corpus = role === undefined ? registry.all : registry.findByRole(role);
    return runSearchTool<ActionEntryInfo>(
      {
        entries: corpus,
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
    definition: DBX_ACTION_SEARCH_TOOL,
    run
  };
  return tool;
}
