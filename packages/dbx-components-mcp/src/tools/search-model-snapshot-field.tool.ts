/**
 * `dbx_model_snapshot_field_search` tool factory.
 *
 * Returns ranked matches across the model-snapshot-fields registry. Unlike
 * `dbx_model_snapshot_field_lookup` — which resolves exactly one topic to
 * a single entry or the catalog — search is deliberately ranked and
 * many-result: give it a keyword (or several space-separated keywords)
 * and it returns the top-N snapshot-field entries scored by where the
 * match landed (name > slug > tags > category > description > param names).
 *
 * Built from a {@link ModelSnapshotFieldRegistry} loaded at server
 * startup. This is the tool that solves the "agent can't find
 * firestoreObjectArray by typing 'array of objects'" problem.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ModelSnapshotFieldEntryInfo, ModelSnapshotFieldRegistry } from '../registry/model-snapshot-fields-runtime.js';
import { runSearchTool, type QueryToken, type SearchHit } from './_search/score.js';
import { resolveSnapshotFieldTopicAlias } from './snapshot-field-alias-resolver.js';
import { type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// MARK: Tool advertisement
const DBX_MODEL_SNAPSHOT_FIELD_SEARCH_TOOL: Tool = {
  name: 'dbx_model_snapshot_field_search',
  description: [
    'Search the @dereekb/firebase snapshot-field registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_model_snapshot_field_lookup` with the slug/name.',
    '',
    'Covers snapshot fields tagged with `@dbxModelSnapshotField` across @dereekb/firebase, plus any downstream manifests registered via `dbx-mcp.config.json`.',
    '',
    'Query strategy:',
    '  • Tokens are scored independently against names, slugs, tags, categories, descriptions, param names, and aliased synonyms (e.g. `encoded` → `object`, `coords` → `lat-lng`, `reference` → `model-key`).',
    '  • Entries matching at least one token are returned, ranked by match-count then by score — full-token matches always rank above partial-token matches.',
    '  • Optional `category` (e.g. "date", "array", "model-key"), `module`, and `optional` filters narrow the candidate pool before scoring.',
    '',
    'Use `dbx_model_snapshot_field_lookup` when you already know the slug or exported name. Use this tool when you only have an intent keyword (e.g. "date", "encoded array", "model key").'
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
      category: {
        type: 'string',
        description: 'Optional category filter (e.g. "primitive", "date", "array", "map", "object", "model-key", "geo"). Narrows the candidate pool before scoring.'
      },
      module: {
        type: 'string',
        description: 'Optional module filter (e.g. "@dereekb/firebase"). Narrows the candidate pool before scoring.'
      },
      optional: {
        type: 'boolean',
        description: 'Optional filter — pass `true` to only see optionalFirestore* variants, `false` to only see required ones.'
      }
    },
    required: ['query']
  }
};

function scoreNameMatch(name: string, token: string): number {
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

function scoreSlugMatch(slug: string, token: string): number {
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

function scoreTagsMatch(tags: readonly string[], token: string): number {
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

function scoreParamsMatch(params: readonly { readonly name: string }[], token: string): number {
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
 * Scores a single snapshot-field entry against a single token. Weights
 * are deliberately spaced so stacked hits can't fabricate a higher score
 * than the next-better match kind.
 *
 * @param entry - The registry entry being scored.
 * @param token - The lowercase token to score against.
 * @returns The additive score for this token/entry pair (`0` when there's no hit)
 */
function scoreFieldAgainstToken(entry: ModelSnapshotFieldEntryInfo, token: string): number {
  const name = entry.name.toLowerCase();
  const slug = entry.slug.toLowerCase();
  const category = entry.category.toLowerCase();
  const description = entry.description.toLowerCase();

  let score = scoreNameMatch(name, token) + scoreSlugMatch(slug, token) + scoreTagsMatch(entry.tags, token);

  if (category === token) {
    score += 3;
  }
  if (score === 0 && description.includes(token)) {
    score += 2;
  }
  if (score === 0) {
    score += scoreParamsMatch(entry.params, token);
  }
  return score;
}

interface SearchToolArgs {
  readonly query: string;
  readonly limit?: number;
  readonly category?: string;
  readonly module?: string;
  readonly optional?: boolean;
}

// MARK: Formatting
interface FormatResultsInput {
  readonly query: string;
  readonly tokens: readonly QueryToken[];
  readonly hits: readonly SearchHit<ModelSnapshotFieldEntryInfo>[];
  readonly category: string | undefined;
  readonly module: string | undefined;
  readonly optional: boolean | undefined;
}

function formatSearchResults(input: FormatResultsInput): string {
  const { query, tokens, hits, category, module, optional } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  const filterParts: string[] = [];
  if (category !== undefined) filterParts.push(`category=\`${category}\``);
  if (module !== undefined) filterParts.push(`module=\`${module}\``);
  if (optional !== undefined) filterParts.push(`optional=\`${optional}\``);
  const filterSuffix = filterParts.length > 0 ? ` (filters: ${filterParts.join(', ')})` : '';

  if (hits.length === 0) {
    return [`No snapshot-field entries matched \`${query}\`${filterSuffix} (tokens: \`${tokenDisplay}\`).`, '', 'All tokens missed the registry. Try `dbx_model_snapshot_field_lookup topic="list"` for the full catalog.'].join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\`${filterSuffix}`, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, ''];
  for (const hit of hits) {
    const entry = hit.entry;
    const tagBadges = entry.tags
      .slice(0, 8)
      .map((t) => '`' + t + '`')
      .join(', ');
    const tagDisplay = entry.tags.length > 0 ? `\n- **tags:** ${tagBadges}` : '';
    const optBadge = entry.optional ? ' · optional' : '';
    lines.push(`## \`${entry.slug}\` · \`${entry.name}\` · ${entry.kind}${optBadge} · score ${hit.score}`, '', `- **module:** \`${entry.module}\``, `- **category:** \`${entry.category}\``, `- **subpath:** \`${entry.subpath}\``, `- **signature:** \`${entry.signature}\``, `- **matched:** \`${hit.matchedTokens.join(', ')}\`${tagDisplay}`, '', entry.description.split('\n')[0], '', `→ \`dbx_model_snapshot_field_lookup topic="${entry.slug}"\` for full docs.`, '');
  }
  return lines.join('\n').trimEnd();
}

// MARK: Factory
/**
 * Configuration for {@link createSearchModelSnapshotFieldTool}.
 */
export interface CreateSearchModelSnapshotFieldToolConfig {
  readonly registry: ModelSnapshotFieldRegistry;
}

/**
 * Builds the `dbx_model_snapshot_field_search` tool against a
 * model-snapshot-fields registry. Called by {@link registerTools} once the
 * registry has loaded at server startup.
 *
 * @param config - The registry the tool should rank against.
 * @returns A registered {@link DbxTool} ready to add to the dispatch table.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createSearchModelSnapshotFieldTool(config: CreateSearchModelSnapshotFieldToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    const args = (rawArgs ?? {}) as SearchToolArgs;
    const category = typeof args.category === 'string' && args.category.length > 0 ? args.category : undefined;
    const module = typeof args.module === 'string' && args.module.length > 0 ? args.module : undefined;
    const optional = typeof args.optional === 'boolean' ? args.optional : undefined;
    let entries: readonly ModelSnapshotFieldEntryInfo[] = registry.all;
    if (category !== undefined) {
      entries = entries.filter((e) => e.category === category);
    }
    if (module !== undefined) {
      entries = entries.filter((e) => e.module === module);
    }
    if (optional !== undefined) {
      entries = entries.filter((e) => e.optional === optional);
    }
    return runSearchTool<ModelSnapshotFieldEntryInfo>(
      {
        entries,
        defaultLimit: DEFAULT_LIMIT,
        maxLimit: MAX_LIMIT,
        aliasResolver: resolveSnapshotFieldTopicAlias,
        tokenMatchMode: 'any',
        scoreEntry: scoreFieldAgainstToken,
        tieBreaker: (entry) => entry.slug,
        formatResults: ({ query, tokens, hits }) => formatSearchResults({ query, tokens, hits, category, module, optional })
      },
      rawArgs
    );
  }

  const tool: DbxTool = {
    definition: DBX_MODEL_SNAPSHOT_FIELD_SEARCH_TOOL,
    run
  };
  return tool;
}
