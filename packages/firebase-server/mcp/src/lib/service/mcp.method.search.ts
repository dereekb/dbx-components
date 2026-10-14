import { buildRankedSearchEntries, buildRankedSearchSynonyms, rankSearchEntries, RANKED_SEARCH_ENGLISH_STOP_WORDS, RANKED_SEARCH_NAME_WEIGHTS, RANKED_SEARCH_SLUG_WEIGHTS, RANKED_SEARCH_TAG_WEIGHTS, RANKED_SEARCH_TEXT_WEIGHTS, type Maybe, type RankedSearchEntry, type RankedSearchSynonyms } from '@dereekb/util';
import { type McpManifestModelEntry } from './mcp.manifest';
import { mcpMethodKinds, type McpMethod, type McpMethodKind, type McpMethodView } from './mcp.method';
import { MCP_DESTRUCTIVE_TOOL_DESCRIPTION_PREFIX, MCP_WRITE_TOOL_DESCRIPTION_PREFIX } from './mcp.tool-generator';

/**
 * Default number of results returned by the compact `search` tool.
 */
export const DEFAULT_MCP_METHOD_SEARCH_LIMIT = 8;

/**
 * Maximum number of results the compact `search` tool returns.
 */
export const MAX_MCP_METHOD_SEARCH_LIMIT = 50;

/**
 * Groups of interchangeable verbs for method search, so a query word finds a method named with another word of its group
 * (`remove entry` finds `guestbookEntry.delete`).
 */
export const MCP_METHOD_SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['delete', 'remove', 'erase', 'destroy'],
  ['create', 'add', 'new', 'make'],
  ['update', 'edit', 'change', 'modify'],
  ['query', 'list', 'find', 'search'],
  ['read', 'get', 'fetch', 'show', 'view']
];

/**
 * The {@link MCP_METHOD_SEARCH_SYNONYM_GROUPS} as a synonym map.
 */
export const MCP_METHOD_SEARCH_SYNONYMS: RankedSearchSynonyms = buildRankedSearchSynonyms(MCP_METHOD_SEARCH_SYNONYM_GROUPS);

/**
 * Pre-tokenized search entries for every registered method. Built once per process.
 */
export type McpMethodSearchEntries = readonly RankedSearchEntry<McpMethod>[];

/**
 * Returns the method's description with the `[WRITE] ` or `[DESTRUCTIVE] ` marker stripped.
 *
 * @param method - The method.
 * @returns The plain description.
 */
export function mcpMethodPlainDescription(method: McpMethod): string {
  const description = method.definition.description;
  const marker = [MCP_WRITE_TOOL_DESCRIPTION_PREFIX, MCP_DESTRUCTIVE_TOOL_DESCRIPTION_PREFIX].find((prefix) => description.startsWith(prefix));
  return marker == null ? description : description.slice(marker.length);
}

/**
 * Reads the top-level input property names declared by the method's input schema.
 *
 * @param method - The method.
 * @returns The property names, or an empty array when the schema declares none.
 */
export function mcpMethodInputPropertyNames(method: McpMethod): string[] {
  const properties = (method.definition.inputSchema as Maybe<{ properties?: Record<string, unknown> }>)?.properties;
  return properties != null && typeof properties === 'object' ? Object.keys(properties) : [];
}

function readInputPropertyDescriptions(method: McpMethod): string[] {
  const properties = (method.definition.inputSchema as Maybe<{ properties?: Record<string, Maybe<{ description?: unknown }>> }>)?.properties;
  const result: string[] = [];

  if (properties != null && typeof properties === 'object') {
    for (const property of Object.values(properties)) {
      if (typeof property?.description === 'string') {
        result.push(property.description);
      }
    }
  }

  return result;
}

/**
 * Builds the search entries over the registered methods.
 *
 * Field weights, best first: id and aliases > model type/name/group (joined from the manifest `models`) >
 * specifier > call > description > input property names and descriptions.
 *
 * @param methods - The registered methods.
 * @param models - The manifest `models` catalog, when loaded.
 * @returns The search entries.
 */
export function buildMcpMethodSearchEntries(methods: readonly McpMethod[], models?: Maybe<readonly McpManifestModelEntry[]>): RankedSearchEntry<McpMethod>[] {
  const modelsByType = new Map((models ?? []).map((model) => [model.modelType, model]));

  return buildRankedSearchEntries(methods, [
    { read: (method) => [method.id, ...method.aliases], weights: RANKED_SEARCH_NAME_WEIGHTS },
    {
      read: (method) => {
        const model = method.modelType == null ? undefined : modelsByType.get(method.modelType);
        return [method.modelType, model?.modelName, model?.modelGroup];
      },
      weights: RANKED_SEARCH_SLUG_WEIGHTS
    },
    { read: (method) => method.specifier, weights: RANKED_SEARCH_TAG_WEIGHTS },
    { read: (method) => method.call, weights: RANKED_SEARCH_TAG_WEIGHTS },
    { read: (method) => mcpMethodPlainDescription(method), weights: RANKED_SEARCH_TEXT_WEIGHTS },
    { read: (method) => [...mcpMethodInputPropertyNames(method), ...readInputPropertyDescriptions(method)], weights: RANKED_SEARCH_TEXT_WEIGHTS }
  ]);
}

/**
 * Input for {@link searchMcpMethods}.
 */
export interface SearchMcpMethodsInput {
  readonly entries: McpMethodSearchEntries;
  /**
   * The caller's visible methods. Only these are ever returned.
   */
  readonly view: McpMethodView;
  readonly query: string;
  /**
   * Restricts results to one model type (case-insensitive). With an empty query, lists that model's methods.
   */
  readonly model?: Maybe<string>;
  /**
   * Restricts results to one method kind: a method's base kind or any kind an escalating param raises a call to. With an
   * empty query, lists every visible method of that kind.
   */
  readonly kind?: Maybe<McpMethodKind>;
  readonly limit?: Maybe<number>;
  /**
   * Number of ranked matches to skip before applying {@link limit}, for paging. Defaults to 0; negative or non-numeric values count as 0.
   *
   * Paging is stable for the same query and caller because ranking ties break on catalog order.
   */
  readonly offset?: Maybe<number>;
  /**
   * Defaults to `all`, which falls back to `any` when no method matches every query word; suggestions use `any`.
   */
  readonly mode?: 'all' | 'any';
}

/**
 * Result of {@link searchMcpMethods}.
 */
export interface SearchMcpMethodsResult {
  readonly methods: readonly McpMethod[];
  /**
   * Total matches before the offset and limit were applied.
   */
  readonly total: number;
  /**
   * The offset that was applied.
   */
  readonly offset: number;
  /**
   * True when no method matched every query word, so {@link methods} match only some of them.
   */
  readonly partial: boolean;
}

/**
 * Searches the caller's visible methods.
 *
 * Query words are matched as keywords: English filler words are dropped ({@link RANKED_SEARCH_ENGLISH_STOP_WORDS}) and
 * common verbs also match their synonyms ({@link MCP_METHOD_SEARCH_SYNONYMS}).
 *
 * @param input - The entries, visible view, query, filters, and page.
 * @returns The page of ranked visible methods, the total match count, the applied offset, and whether the matches are partial.
 */
export function searchMcpMethods(input: SearchMcpMethodsInput): SearchMcpMethodsResult {
  const { entries, view, query, model, kind, mode = 'all' } = input;
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_MCP_METHOD_SEARCH_LIMIT), MAX_MCP_METHOD_SEARCH_LIMIT);
  const offset = typeof input.offset === 'number' && Number.isFinite(input.offset) ? Math.max(0, Math.floor(input.offset)) : 0;
  const modelKey = model?.trim().toLowerCase();
  const hasModelFilter = modelKey != null && modelKey.length > 0;
  const filter = (method: McpMethod) => view.has(method) && (kind == null || mcpMethodKinds(method).includes(kind)) && (!hasModelFilter || method.modelType?.toLowerCase() === modelKey);
  let matches: McpMethod[];
  let partial = false;

  if (query.trim().length === 0) {
    // An empty query only lists when a model or kind narrows it, so it never dumps the whole catalog.
    matches = hasModelFilter || kind != null ? view.methods.filter(filter) : [];
  } else {
    const rankInput = { entries, query, filter, stopWords: RANKED_SEARCH_ENGLISH_STOP_WORDS, synonyms: MCP_METHOD_SEARCH_SYNONYMS };
    matches = rankSearchEntries({ ...rankInput, mode }).map((x) => x.value);

    if (matches.length === 0 && mode === 'all') {
      matches = rankSearchEntries({ ...rankInput, mode: 'any' }).map((x) => x.value);
      partial = matches.length > 0;
    }

    // Methods built per request (e.g. batch-execute) are not in the boot index; match them by id.
    const lowerQuery = query.trim().toLowerCase();

    for (const method of view.methods) {
      if (!matches.includes(method) && filter(method) && !entries.some((entry) => entry.value === method) && method.id.toLowerCase().includes(lowerQuery)) {
        matches.push(method);
      }
    }
  }

  return { methods: matches.slice(offset, offset + limit), total: matches.length, offset, partial };
}

/**
 * Suggests up to `limit` visible methods for a name the caller could not resolve.
 *
 * @param input - The entries, visible view, and the unresolved name.
 * @param input.entries - The method search entries.
 * @param input.view - The caller's visible methods.
 * @param input.name - The name the caller could not resolve.
 * @param input.limit - Maximum suggestions (default 3).
 * @returns The suggested method ids.
 */
export function suggestMcpMethods(input: { readonly entries: McpMethodSearchEntries; readonly view: McpMethodView; readonly name: string; readonly limit?: number }): string[] {
  return searchMcpMethods({ entries: input.entries, view: input.view, query: input.name, mode: 'any', limit: input.limit ?? 3 }).methods.map((x) => x.id);
}
