/**
 * `dbx_model_firebase_index_search` tool.
 *
 * Returns ranked matches across the model-firebase-index registry. Unlike
 * `dbx_model_firebase_index_lookup` — which resolves exactly one topic to
 * a single entry or the catalog — search is deliberately ranked and
 * many-result: give it a keyword (or several space-separated keywords)
 * and it returns the top-N firebase-index entries scored by where the
 * match landed (slug > name > model > collection > tags > category >
 * description).
 *
 * Built from a {@link ModelFirebaseIndexRegistry} loaded at server
 * startup.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ModelFirebaseIndexEntryInfo, ModelFirebaseIndexRegistry } from '../registry/model-firebase-index-runtime.js';
import { runSearchTool, type QueryToken, type SearchHit } from './_search/score.js';
import { type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_MODEL_FIREBASE_INDEX_SEARCH_TOOL: Tool = {
  name: 'dbx_model_firebase_index_search',
  description: [
    'Search the model-firebase-index registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_model_firebase_index_lookup` with the slug/name.',
    '',
    'Covers `*.query.ts` factories tagged with `@dbxModelFirebaseIndex` across @dereekb/firebase, plus any downstream manifests registered via `dbx-mcp.config.json`.',
    '',
    'Query strategy:',
    '  • Tokens are scored independently against slug, name, target model, resolved collection name, tags, category, and description.',
    '  • Entries matching at least one token are returned, ranked by match-count then by score — full-token matches always rank above partial-token matches.',
    '  • Optional `collection` (short collection name, e.g. "jlw"), `model` (TS type name, e.g. "JobLocationWeek"), `scope`, `category`, and `module` filters narrow the candidate pool before scoring.',
    '',
    'Use `dbx_model_firebase_index_lookup` when you already know the slug or exported name. Use this tool when you only have an intent keyword (e.g. "dirty", "sync", "district week").'
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
      },
      collection: {
        type: 'string',
        description: 'Optional collection filter (short collection name, e.g. "jlw").'
      },
      model: {
        type: 'string',
        description: 'Optional model filter (TS type name, e.g. "JobLocationWeek").'
      },
      scope: {
        type: 'string',
        enum: ['COLLECTION', 'COLLECTION_GROUP'],
        description: 'Optional scope filter.'
      },
      category: {
        type: 'string',
        description: 'Optional category filter (e.g. "sync", "dirty", "scan").'
      },
      module: {
        type: 'string',
        description: 'Optional module filter (e.g. "@dereekb/firebase", "@hellosubs/firebase").'
      }
    },
    required: ['query']
  }
};

function scoreSlugMatch(slug: string, token: string): number {
  let score = 0;
  if (slug === token) {
    score = 10;
  } else if (slug.startsWith(token)) {
    score = 7;
  } else if (slug.includes(token)) {
    score = 5;
  }
  return score;
}

function scoreNameMatch(name: string, token: string): number {
  let score = 0;
  if (name === token) {
    score = 9;
  } else if (name.startsWith(token)) {
    score = 6;
  } else if (name.includes(token)) {
    score = 4;
  }
  return score;
}

function scoreModelMatch(model: string, token: string): number {
  let score = 0;
  if (model === token) {
    score = 8;
  } else if (model.includes(token)) {
    score = 3;
  }
  return score;
}

function scoreCollectionMatch(collection: string, token: string): number {
  let score = 0;
  if (collection === token) {
    score = 7;
  } else if (collection.includes(token)) {
    score = 3;
  }
  return score;
}

function scoreTagsMatch(tags: readonly string[], token: string): number {
  let best = 0;
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === token) {
      best = Math.max(best, 6);
    } else if (tagLower.includes(token)) {
      best = Math.max(best, 3);
    }
  }
  return best;
}

/**
 * Scores a single firebase-index entry against a single token.
 *
 * @param entry - the registry entry being scored
 * @param token - the lowercase token to score against
 * @returns the additive score for this token/entry pair (`0` when there's no hit)
 */
function scoreIndexAgainstToken(entry: ModelFirebaseIndexEntryInfo, token: string): number {
  const slug = entry.slug.toLowerCase();
  const name = entry.name.toLowerCase();
  const model = entry.model.toLowerCase();
  const collection = entry.collection.toLowerCase();
  const category = entry.category.toLowerCase();
  const description = entry.description.toLowerCase();

  let score = scoreSlugMatch(slug, token) + scoreNameMatch(name, token) + scoreModelMatch(model, token) + scoreCollectionMatch(collection, token) + scoreTagsMatch(entry.tags, token);

  if (category === token) {
    score += 3;
  } else if (category.length > 0 && category.includes(token)) {
    score += 1;
  }

  if (score === 0 && description.includes(token)) {
    score += 2;
  }
  return score;
}

interface SearchToolArgs {
  readonly query: string;
  readonly limit?: number;
  readonly collection?: string;
  readonly model?: string;
  readonly scope?: 'COLLECTION' | 'COLLECTION_GROUP';
  readonly category?: string;
  readonly module?: string;
}

// MARK: Formatting
interface FormatResultsInput {
  readonly query: string;
  readonly tokens: readonly QueryToken[];
  readonly hits: readonly SearchHit<ModelFirebaseIndexEntryInfo>[];
  readonly collection: string | undefined;
  readonly model: string | undefined;
  readonly scope: 'COLLECTION' | 'COLLECTION_GROUP' | undefined;
  readonly category: string | undefined;
  readonly module: string | undefined;
}

function formatSearchResults(input: FormatResultsInput): string {
  const { query, tokens, hits, collection, model, scope, category, module } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  const filterParts: string[] = [];
  if (collection !== undefined) filterParts.push(`collection=\`${collection}\``);
  if (model !== undefined) filterParts.push(`model=\`${model}\``);
  if (scope !== undefined) filterParts.push(`scope=\`${scope}\``);
  if (category !== undefined) filterParts.push(`category=\`${category}\``);
  if (module !== undefined) filterParts.push(`module=\`${module}\``);
  const filterSuffix = filterParts.length > 0 ? ` (filters: ${filterParts.join(', ')})` : '';

  if (hits.length === 0) {
    return [`No firebase-index entries matched \`${query}\`${filterSuffix} (tokens: \`${tokenDisplay}\`).`, '', 'All tokens missed the registry. Try `dbx_model_firebase_index_lookup topic="list"` for the full catalog.'].join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\`${filterSuffix}`, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const entry = hit.entry;
    const tagBadges = entry.tags
      .slice(0, 8)
      .map((t) => '`' + t + '`')
      .join(', ');
    const tagDisplay = entry.tags.length > 0 ? `\n- **tags:** ${tagBadges}` : '';
    const flagBadge = `${entry.skip ? ' · skip' : ''}${entry.manual ? ' · manual' : ''}`;
    lines.push(
      `## \`${entry.slug}\` · \`${entry.name}\` · ${entry.scope}${flagBadge} · score ${hit.score}`,
      '',
      `- **module:** \`${entry.module}\``,
      `- **model:** \`${entry.model}\``,
      `- **collection:** \`${entry.collection}\``,
      `- **category:** \`${entry.category}\``,
      `- **subpath:** \`${entry.subpath}\``,
      `- **matched:** \`${hit.matchedTokens.join(', ')}\`${tagDisplay}`,
      '',
      entry.description.split('\n')[0],
      '',
      `→ \`dbx_model_firebase_index_lookup topic="${entry.slug}"\` for full docs.`,
      ''
    );
  }
  return lines.join('\n').trimEnd();
}

// MARK: Factory
/**
 * Configuration for {@link createSearchModelFirebaseIndexTool}.
 */
export interface CreateSearchModelFirebaseIndexToolConfig {
  readonly registry: ModelFirebaseIndexRegistry;
}

/**
 * Builds the `dbx_model_firebase_index_search` tool against a
 * model-firebase-index registry. Called by `registerTools` once the
 * registry has loaded at server startup.
 *
 * @param config - the registry the tool should rank against
 * @returns a registered {@link DbxTool} ready to add to the dispatch table
 * @__NO_SIDE_EFFECTS__
 */
export function createSearchModelFirebaseIndexTool(config: CreateSearchModelFirebaseIndexToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    const args = (rawArgs ?? {}) as SearchToolArgs;
    const collection = typeof args.collection === 'string' && args.collection.length > 0 ? args.collection : undefined;
    const model = typeof args.model === 'string' && args.model.length > 0 ? args.model : undefined;
    const scope = args.scope === 'COLLECTION' || args.scope === 'COLLECTION_GROUP' ? args.scope : undefined;
    const category = typeof args.category === 'string' && args.category.length > 0 ? args.category : undefined;
    const module = typeof args.module === 'string' && args.module.length > 0 ? args.module : undefined;
    let entries: readonly ModelFirebaseIndexEntryInfo[] = registry.all;
    if (collection !== undefined) {
      entries = entries.filter((e) => e.collection === collection);
    }
    if (model !== undefined) {
      entries = entries.filter((e) => e.model === model);
    }
    if (scope !== undefined) {
      entries = entries.filter((e) => e.scope === scope);
    }
    if (category !== undefined) {
      entries = entries.filter((e) => e.category === category);
    }
    if (module !== undefined) {
      entries = entries.filter((e) => e.module === module);
    }
    return runSearchTool<ModelFirebaseIndexEntryInfo>(
      {
        entries,
        defaultLimit: DEFAULT_LIMIT,
        maxLimit: MAX_LIMIT,
        tokenMatchMode: 'any',
        scoreEntry: scoreIndexAgainstToken,
        tieBreaker: (entry) => entry.slug,
        formatResults: ({ query, tokens, hits }) => formatSearchResults({ query, tokens, hits, collection, model, scope, category, module })
      },
      rawArgs
    );
  }

  const tool: DbxTool = {
    definition: DBX_MODEL_FIREBASE_INDEX_SEARCH_TOOL,
    run
  };
  return tool;
}
