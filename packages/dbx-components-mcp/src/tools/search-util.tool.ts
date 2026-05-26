/**
 * `dbx_util_search` tool factory.
 *
 * Returns ranked matches across the utils registry. Unlike
 * `dbx_util_lookup` — which resolves exactly one topic to a single entry
 * or the catalog — search is deliberately ranked and many-result: give
 * it a keyword (or several space-separated keywords) and it returns the
 * top-N utility entries scored by where the match landed (name > slug >
 * tags > category > description > param names).
 *
 * Built from a {@link UtilRegistry} loaded at server startup. This is the
 * tool that solves the "agent can't find expirationDetails by typing
 * 'expiration'" problem.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import type { UtilEntryInfo, UtilRegistry } from '@dereekb/dbx-cli';
import { DEFAULT_CATALOG_LIMIT, MAX_CATALOG_LIMIT, buildCatalogSearchInputSchema, formatCatalogSearchResults, scoreCatalogEntryToken } from './_search/catalog-search.js';
import { runSearchTool } from './_search/score.js';
import { type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const DBX_UTIL_SEARCH_TOOL: Tool = {
  name: 'dbx_util_search',
  description: [
    'Search the @dereekb/* utility registry by keyword(s). Returns ranked candidates — pick one, then call `dbx_util_lookup` with the slug/name.',
    '',
    'Covers utilities tagged with `@dbxUtil` across @dereekb/util, @dereekb/date, @dereekb/rxjs, @dereekb/model, plus any downstream manifests registered via `dbx-mcp.config.json`.',
    '',
    'Query strategy:',
    '  • Space-separated tokens are ANDed (every token must contribute at least some score).',
    '  • Optional `category` and `module` filters narrow the candidate pool before scoring.',
    '',
    'Use `dbx_util_lookup` when you already know the slug or exported name. Use this tool when you only have an intent keyword (e.g. "expiration", "throttle", "memoize").'
  ].join('\n'),
  inputSchema: buildCatalogSearchInputSchema({
    descriptions: {
      category: 'Optional category filter (e.g. "date", "promise", "array"). Narrows the candidate pool before scoring.'
    }
  })
};

interface SearchToolArgs {
  readonly query: string;
  readonly limit?: number;
  readonly category?: string;
  readonly module?: string;
}

// MARK: Factory
/**
 * Configuration for {@link createSearchUtilTool}.
 */
export interface CreateSearchUtilToolConfig {
  readonly registry: UtilRegistry;
}

/**
 * Builds the `dbx_util_search` tool against a utils registry. Called by
 * {@link registerTools} once the registry has loaded at server startup.
 *
 * @param config - The registry the tool should rank against.
 * @returns A registered {@link DbxTool} ready to add to the dispatch table.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createSearchUtilTool(config: CreateSearchUtilToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    const args = (rawArgs ?? {}) as SearchToolArgs;
    const category = typeof args.category === 'string' && args.category.length > 0 ? args.category : undefined;
    const module = typeof args.module === 'string' && args.module.length > 0 ? args.module : undefined;
    let entries: readonly UtilEntryInfo[] = registry.all;
    if (category !== undefined) {
      entries = entries.filter((e) => e.category === category);
    }
    if (module !== undefined) {
      entries = entries.filter((e) => e.module === module);
    }
    return runSearchTool<UtilEntryInfo>(
      {
        entries,
        defaultLimit: DEFAULT_CATALOG_LIMIT,
        maxLimit: MAX_CATALOG_LIMIT,
        scoreEntry: scoreCatalogEntryToken,
        tieBreaker: (entry) => entry.slug,
        formatResults: ({ query, tokens, hits }) =>
          formatCatalogSearchResults<UtilEntryInfo>({
            query,
            tokens,
            hits,
            filters: [
              { key: 'category', value: category },
              { key: 'module', value: module }
            ],
            entityLabel: 'utility entries',
            emptyHint: 'Try `dbx_util_lookup topic="list"` for the catalog or a broader single-word query.',
            hitOptions: { lookupTool: 'dbx_util_lookup' }
          })
      },
      rawArgs
    );
  }

  const tool: DbxTool = {
    definition: DBX_UTIL_SEARCH_TOOL,
    run
  };
  return tool;
}
