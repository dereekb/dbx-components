import { buildRankedSearchEntries, rankSearchEntries, RANKED_SEARCH_NAME_WEIGHTS, RANKED_SEARCH_SLUG_WEIGHTS, RANKED_SEARCH_TAG_WEIGHTS, RANKED_SEARCH_TEXT_WEIGHTS, type Maybe, type RankedSearchEntry } from '@dereekb/util';
import { type McpManifestModelEntry } from './mcp.manifest';
import { type McpMethod, type McpMethodKind, type McpMethodView } from './mcp.method';
import { MCP_WRITE_TOOL_DESCRIPTION_PREFIX } from './mcp.tool-generator';

/**
 * Default number of results returned by the compact `search` tool.
 */
export const DEFAULT_MCP_METHOD_SEARCH_LIMIT = 8;

/**
 * Maximum number of results the compact `search` tool returns.
 */
export const MAX_MCP_METHOD_SEARCH_LIMIT = 50;

/**
 * Pre-tokenized search entries for every registered method. Built once per process.
 */
export type McpMethodSearchEntries = readonly RankedSearchEntry<McpMethod>[];

/**
 * Returns the method's description with the `[WRITE] ` marker stripped.
 *
 * @param method - The method.
 * @returns The plain description.
 */
export function mcpMethodPlainDescription(method: McpMethod): string {
  const description = method.definition.description;
  return description.startsWith(MCP_WRITE_TOOL_DESCRIPTION_PREFIX) ? description.slice(MCP_WRITE_TOOL_DESCRIPTION_PREFIX.length) : description;
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
   * Restricts results to one method kind. With an empty query, lists every visible method of that kind.
   */
  readonly kind?: Maybe<McpMethodKind>;
  readonly limit?: Maybe<number>;
  /**
   * Defaults to `all`; suggestions use `any`.
   */
  readonly mode?: 'all' | 'any';
}

/**
 * Result of {@link searchMcpMethods}.
 */
export interface SearchMcpMethodsResult {
  readonly methods: readonly McpMethod[];
  /**
   * Total matches before the limit was applied.
   */
  readonly total: number;
}

/**
 * Searches the caller's visible methods.
 *
 * @param input - The entries, visible view, query, and filters.
 * @returns The ranked visible methods and the total match count.
 */
export function searchMcpMethods(input: SearchMcpMethodsInput): SearchMcpMethodsResult {
  const { entries, view, query, model, kind, mode } = input;
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_MCP_METHOD_SEARCH_LIMIT), MAX_MCP_METHOD_SEARCH_LIMIT);
  const modelKey = model?.trim().toLowerCase();
  const hasModelFilter = modelKey != null && modelKey.length > 0;
  const filter = (method: McpMethod) => view.has(method) && (kind == null || method.kind === kind) && (!hasModelFilter || method.modelType?.toLowerCase() === modelKey);
  let matches: McpMethod[];

  if (query.trim().length === 0) {
    // An empty query only lists when a model or kind narrows it, so it never dumps the whole catalog.
    matches = hasModelFilter || kind != null ? view.methods.filter(filter) : [];
  } else {
    matches = rankSearchEntries({ entries, query, mode, filter }).map((x) => x.value);

    // Methods built per request (e.g. batch-execute) are not in the boot index; match them by id.
    const lowerQuery = query.trim().toLowerCase();

    for (const method of view.methods) {
      if (!matches.includes(method) && filter(method) && !entries.some((entry) => entry.value === method) && method.id.toLowerCase().includes(lowerQuery)) {
        matches.push(method);
      }
    }
  }

  return { methods: matches.slice(0, limit), total: matches.length };
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
