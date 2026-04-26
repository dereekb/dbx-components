/**
 * `dbx_semantic_type_search` tool factory.
 *
 * Filter the merged semantic-types registry by topic, baseType, package,
 * substring query, or any AND-combination of those. At least one filter
 * is required so the tool never has to render the entire registry — that
 * job belongs to `dbx_semantic_type_lookup name="catalog"`.
 *
 * Results are emitted in brief form sorted alphabetically by name. The
 * tool wraps a {@link SemanticTypeRegistry} the way the lookup tool does;
 * {@link createSemanticTypeSearchTool} is invoked from {@link registerTools}
 * after the registry is loaded at server startup.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import type { SemanticTypeEntry } from '../manifest/semantic-types-schema.js';
import type { SemanticTypeRegistry } from '../registry/semantic-types.js';
import { formatSemanticTypeSearchResults } from './semantic-type-lookup.formatter.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// MARK: Tool advertisement
const DBX_SEMANTIC_TYPE_SEARCH_TOOL: Tool = {
  name: 'dbx_semantic_type_search',
  description: [
    'Search the merged semantic-types registry by any combination of:',
    "  • `topic` — bare core topic (e.g. 'duration') or namespaced topic (e.g. 'dereekb-util:duration').",
    "  • `baseType` — one of 'string', 'number', 'boolean', 'object', 'branded', 'union-literal', 'template-literal', 'other'.",
    "  • `package` — exact package label (e.g. '@dereekb/util').",
    '  • `query` — substring search across name, module, and definition (case-insensitive).',
    '',
    'Filters AND together. At least one filter is required.',
    '',
    'Results are returned in brief form sorted by name. Pass the result back into `dbx_semantic_type_lookup name="<...>" depth="full"` for the full entry.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Bare core topic or namespaced topic.' },
      baseType: { type: 'string', description: 'baseType filter.' },
      package: { type: 'string', description: 'Exact package label (e.g. "@dereekb/util").' },
      query: { type: 'string', description: 'Substring search across name, module, definition.' },
      limit: {
        type: 'number',
        description: `Maximum results to return. Defaults to ${DEFAULT_LIMIT}, capped at ${MAX_LIMIT}.`,
        minimum: 1,
        maximum: MAX_LIMIT,
        default: DEFAULT_LIMIT
      }
    }
  }
};

// MARK: Input validation
const SearchSemanticTypeArgsType = type({
  'topic?': 'string',
  'baseType?': 'string',
  'package?': 'string',
  'query?': 'string',
  'limit?': 'number'
});

interface ParsedSearchArgs {
  readonly topic: string | undefined;
  readonly baseType: string | undefined;
  readonly package: string | undefined;
  readonly query: string | undefined;
  readonly limit: number;
}

function parseSearchArgs(raw: unknown): ParsedSearchArgs {
  const parsed = SearchSemanticTypeArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const rawLimit = parsed.limit ?? DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(rawLimit)));
  const result: ParsedSearchArgs = {
    topic: nonEmpty(parsed.topic),
    baseType: nonEmpty(parsed.baseType),
    package: nonEmpty(parsed.package),
    query: nonEmpty(parsed.query),
    limit
  };
  return result;
}

function nonEmpty(value: string | undefined): string | undefined {
  let result: string | undefined;
  if (value === undefined) {
    result = undefined;
  } else {
    const trimmed = value.trim();
    result = trimmed.length === 0 ? undefined : trimmed;
  }
  return result;
}

// MARK: Factory
/**
 * Configuration for {@link createSemanticTypeSearchTool}.
 */
export interface CreateSemanticTypeSearchToolConfig {
  readonly registry: SemanticTypeRegistry;
}

/**
 * Builds the `dbx_semantic_type_search` tool against a registry. Called by
 * {@link registerTools} once the registry has been loaded at server startup.
 *
 * @param config - the registry to filter against
 * @returns a registered {@link DbxTool} ready to add to the dispatch table
 */
export function createSemanticTypeSearchTool(config: CreateSemanticTypeSearchToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    let args: ParsedSearchArgs;
    let result: ToolResult;
    try {
      args = parseSearchArgs(rawArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }

    const filterCount = countDefined([args.topic, args.baseType, args.package, args.query]);
    if (filterCount === 0) {
      result = toolError('At least one filter (topic, baseType, package, query) must be supplied.');
    } else {
      const matches = applyFilters(registry, args);
      const limited = matches.slice(0, args.limit);
      const text = formatSemanticTypeSearchResults({
        query: describeFilters(args),
        entries: limited
      });
      result = { content: [{ type: 'text', text }] };
    }
    return result;
  }

  const tool: DbxTool = {
    definition: DBX_SEMANTIC_TYPE_SEARCH_TOOL,
    run
  };
  return tool;
}

// MARK: Filtering
function applyFilters(registry: SemanticTypeRegistry, args: ParsedSearchArgs): readonly SemanticTypeEntry[] {
  let candidates: readonly SemanticTypeEntry[];
  if (args.topic !== undefined) {
    candidates = registry.findByTopic(args.topic);
  } else if (args.baseType !== undefined) {
    candidates = registry.findByBaseType(args.baseType);
  } else if (args.package !== undefined) {
    candidates = registry.findByPackage(args.package);
  } else if (args.query !== undefined) {
    candidates = registry.findByQuery(args.query);
  } else {
    candidates = registry.all;
  }

  return candidates.filter((entry) => matchesAllFilters(entry, args));
}

function matchesAllFilters(entry: SemanticTypeEntry, args: ParsedSearchArgs): boolean {
  let result = true;
  if (args.topic !== undefined && !entry.topics.includes(args.topic)) {
    result = false;
  }
  if (result && args.baseType !== undefined && entry.baseType !== args.baseType) {
    result = false;
  }
  if (result && args.package !== undefined && entry.package !== args.package) {
    result = false;
  }
  if (result && args.query !== undefined) {
    const haystack = `${entry.name}\n${entry.module}\n${entry.definition}`.toLowerCase();
    if (!haystack.includes(args.query.toLowerCase())) {
      result = false;
    }
  }
  return result;
}

function countDefined(values: readonly (string | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (v === undefined ? 0 : 1), 0);
}

function describeFilters(args: ParsedSearchArgs): string {
  const parts: string[] = [];
  if (args.topic !== undefined) {
    parts.push(`topic=${args.topic}`);
  }
  if (args.baseType !== undefined) {
    parts.push(`baseType=${args.baseType}`);
  }
  if (args.package !== undefined) {
    parts.push(`package=${args.package}`);
  }
  if (args.query !== undefined) {
    parts.push(`query=${args.query}`);
  }
  return parts.join(' · ');
}
