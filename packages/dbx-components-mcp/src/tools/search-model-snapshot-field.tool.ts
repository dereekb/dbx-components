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
import type { ModelSnapshotFieldEntryInfo, ModelSnapshotFieldRegistry } from '@dereekb/dbx-cli';
import { DEFAULT_CATALOG_LIMIT, MAX_CATALOG_LIMIT, buildCatalogSearchInputSchema, formatCatalogSearchResults, scoreCatalogEntryToken } from './_search/catalog-search.js';
import { runSearchTool } from './_search/score.js';
import { resolveSnapshotFieldTopicAlias } from './snapshot-field-alias-resolver.js';
import { type DbxTool, type ToolResult } from './types.js';

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
  inputSchema: buildCatalogSearchInputSchema({
    descriptions: {
      category: 'Optional category filter (e.g. "primitive", "date", "array", "map", "object", "model-key", "geo"). Narrows the candidate pool before scoring.',
      module: 'Optional module filter (e.g. "@dereekb/firebase"). Narrows the candidate pool before scoring.'
    },
    extraProperties: {
      optional: {
        type: 'boolean',
        description: 'Optional filter — pass `true` to only see optionalFirestore* variants, `false` to only see required ones.'
      }
    }
  })
};

interface SearchToolArgs {
  readonly query: string;
  readonly limit?: number;
  readonly category?: string;
  readonly module?: string;
  readonly optional?: boolean;
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
        defaultLimit: DEFAULT_CATALOG_LIMIT,
        maxLimit: MAX_CATALOG_LIMIT,
        aliasResolver: resolveSnapshotFieldTopicAlias,
        tokenMatchMode: 'any',
        scoreEntry: scoreCatalogEntryToken,
        tieBreaker: (entry) => entry.slug,
        formatResults: ({ query, tokens, hits }) =>
          formatCatalogSearchResults<ModelSnapshotFieldEntryInfo>({
            query,
            tokens,
            hits,
            filters: [
              { key: 'category', value: category },
              { key: 'module', value: module },
              { key: 'optional', value: optional }
            ],
            entityLabel: 'snapshot-field entries',
            emptyHint: 'All tokens missed the registry. Try `dbx_model_snapshot_field_lookup topic="list"` for the full catalog.',
            hitOptions: (hit) => ({
              headerBadge: hit.entry.optional ? ' · optional' : '',
              lookupTool: 'dbx_model_snapshot_field_lookup'
            })
          })
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
