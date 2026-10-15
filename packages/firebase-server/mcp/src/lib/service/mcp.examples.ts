import { type Maybe, RANKED_SEARCH_ENGLISH_STOP_WORDS, splitSearchIdentifierWords } from '@dereekb/util';
import { type McpToolExamplesConfig } from '../mcp.config';
import { type McpManifestEnum, type McpManifestModelEntry } from './mcp.manifest';
import { type McpMethodKind, type McpMethodRegistry, type McpMethodSummary, mcpMethodKinds, MCP_METHOD_KINDS } from './mcp.method';
import { type RouteManifest } from './mcp.route-manifest';
import { DEFAULT_SPECIFIER_KEY } from './mcp.tool-generator';

// MARK: Types
/**
 * Catalog examples for the built-in tools, resolved once at boot from the configured examples and the app's
 * `mcp.manifest.json` / `route.manifest.json`.
 */
export interface McpToolCatalogExamples {
  /**
   * Up to 2 example model types, e.g. `['guestbook', 'profile']`. Empty when none are available.
   */
  readonly modelTypes: readonly string[];
  /**
   * Example full model key, e.g. `gb/abc123`.
   */
  readonly modelKey?: string;
  /**
   * Example enum declaration name.
   */
  readonly enumName?: string;
  /**
   * Example app page URL.
   */
  readonly pageUrl?: string;
}

/**
 * Method examples for the compact tools, resolved per request from the configured examples and the methods the caller
 * can see.
 */
export interface McpToolMethodExamples {
  /**
   * Example method id, e.g. `guestbook.update.subscribeToNotifications`.
   */
  readonly methodId?: string;
  /**
   * Example method id per kind, used by the router tools.
   */
  readonly methodIdByKind: Readonly<Partial<Record<McpMethodKind, string>>>;
  /**
   * Up to 2 example search queries.
   */
  readonly searchQueries: readonly string[];
  /**
   * Example model type for the search `model` filter.
   */
  readonly modelType?: string;
}

/**
 * Catalog examples with no example values.
 */
export const EMPTY_MCP_TOOL_CATALOG_EXAMPLES: McpToolCatalogExamples = Object.freeze({ modelTypes: Object.freeze([]) as readonly string[] });

/**
 * Method examples with no example values.
 */
export const EMPTY_MCP_TOOL_METHOD_EXAMPLES: McpToolMethodExamples = Object.freeze({ methodIdByKind: Object.freeze({}), searchQueries: Object.freeze([]) as readonly string[] });

/**
 * Maximum number of example search queries shown.
 */
export const MCP_TOOL_EXAMPLE_SEARCH_QUERY_LIMIT = 2;

/**
 * Maximum number of example model types shown.
 */
export const MCP_TOOL_EXAMPLE_MODEL_TYPE_LIMIT = 2;

/**
 * Placeholder id used in derived example keys and URLs.
 */
export const MCP_TOOL_EXAMPLE_ID = 'abc123';

/**
 * Base URL used for a derived page URL when the route manifest declares none.
 */
export const MCP_TOOL_EXAMPLE_DEFAULT_BASE_URL = 'https://app.example.com';

// MARK: Catalog
/**
 * Input for {@link resolveMcpToolCatalogExamples}.
 */
export interface ResolveMcpToolCatalogExamplesInput {
  readonly config?: Maybe<McpToolExamplesConfig | false>;
  readonly models?: Maybe<readonly McpManifestModelEntry[]>;
  readonly enums?: Maybe<{ readonly [name: string]: McpManifestEnum }>;
  readonly routeManifest?: Maybe<RouteManifest>;
}

/**
 * Returns true when a manifest model can serve as an example: a root model that is not a singleton, has no composite
 * key, and is not server-only.
 *
 * @param model - The manifest model.
 * @returns Whether the model is a good example.
 */
export function isMcpToolExampleModel(model: McpManifestModelEntry): boolean {
  return model.parentIdentityConst == null && model.singleton !== true && model.compositeKey == null && model.serverOnly !== true;
}

/**
 * Resolves the catalog examples once at boot. Per field: the configured value, then a value derived from the loaded
 * manifests, then none. `config: false` returns {@link EMPTY_MCP_TOOL_CATALOG_EXAMPLES}.
 *
 * @param input - The configured examples and the loaded manifests.
 * @returns The catalog examples.
 */
export function resolveMcpToolCatalogExamples(input: ResolveMcpToolCatalogExamplesInput): McpToolCatalogExamples {
  const { config, models, enums, routeManifest } = input;
  let result: McpToolCatalogExamples;

  if (config === false) {
    result = EMPTY_MCP_TOOL_CATALOG_EXAMPLES;
  } else {
    const exampleModels = (models ?? []).filter(isMcpToolExampleModel);
    const modelTypes = config?.modelType ? [config.modelType] : exampleModels.slice(0, MCP_TOOL_EXAMPLE_MODEL_TYPE_LIMIT).map((x) => x.modelType);
    const firstPrefix = exampleModels[0]?.collectionPrefix;
    const modelKey = config?.modelKey ?? (firstPrefix ? `${firstPrefix}/${MCP_TOOL_EXAMPLE_ID}` : undefined);
    const enumName = config?.enumName ?? (enums ? Object.keys(enums)[0] : undefined);
    const pageUrl = config?.pageUrl ?? mcpToolExamplePageUrl(routeManifest);

    result = {
      modelTypes,
      ...(modelKey ? { modelKey } : undefined),
      ...(enumName ? { enumName } : undefined),
      ...(pageUrl ? { pageUrl } : undefined)
    };
  }

  return result;
}

const ROUTE_URL_PARAM_REGEX = /:[A-Za-z0-9_]+|\{[^}]+\}/g;

/**
 * Derives an example page URL from a route manifest: the first non-abstract state with at least one model and a
 * `fullUrl`, preferring a parameterized one with each param replaced by {@link MCP_TOOL_EXAMPLE_ID}.
 *
 * @param routeManifest - The loaded route manifest.
 * @returns The example URL, or undefined when no state qualifies.
 */
export function mcpToolExamplePageUrl(routeManifest: Maybe<RouteManifest>): Maybe<string> {
  let result: Maybe<string>;

  if (routeManifest) {
    const candidates = routeManifest.states.filter((state) => state.abstract !== true && state.models.length > 0 && state.fullUrl);
    const state = candidates.find((x) => new RegExp(ROUTE_URL_PARAM_REGEX.source).test(x.fullUrl as string)) ?? candidates[0];

    if (state?.fullUrl) {
      const path = state.fullUrl.replaceAll(ROUTE_URL_PARAM_REGEX, MCP_TOOL_EXAMPLE_ID);
      const baseUrl = (routeManifest.app.baseUrl || MCP_TOOL_EXAMPLE_DEFAULT_BASE_URL).replace(/\/+$/, '');
      result = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }
  }

  return result;
}

// MARK: Methods
/**
 * Input for {@link resolveMcpToolMethodExamples}.
 */
export interface ResolveMcpToolMethodExamplesInput {
  readonly config?: Maybe<McpToolExamplesConfig | false>;
  /**
   * The caller's visible methods. Only `callModel` methods are used, so a hidden method is never named.
   */
  readonly methods: readonly McpMethodSummary[];
}

function hasNonDefaultSpecifier(method: McpMethodSummary): boolean {
  return method.specifier != null && method.specifier !== DEFAULT_SPECIFIER_KEY;
}

/**
 * Resolves the method examples for one request. Per field: the configured value, then a value derived from the caller's
 * visible `callModel` methods, then none. `config: false` returns {@link EMPTY_MCP_TOOL_METHOD_EXAMPLES}.
 *
 * @param input - The configured examples and the caller's visible methods.
 * @returns The method examples.
 */
export function resolveMcpToolMethodExamples(input: ResolveMcpToolMethodExamplesInput): McpToolMethodExamples {
  const { config, methods } = input;
  let result: McpToolMethodExamples;

  if (config === false) {
    result = EMPTY_MCP_TOOL_METHOD_EXAMPLES;
  } else {
    const callModelMethods = methods.filter((x) => x.source === 'callModel');
    const exampleMethod = callModelMethods.find((x) => x.call === 'update' && hasNonDefaultSpecifier(x)) ?? callModelMethods.find(hasNonDefaultSpecifier) ?? callModelMethods[0];
    const methodId = config?.methodId ?? exampleMethod?.id;
    const methodIdByKind: Partial<Record<McpMethodKind, string>> = {};

    for (const kind of MCP_METHOD_KINDS) {
      const id = config?.methodId ?? callModelMethods.find((x) => mcpMethodKinds(x).includes(kind))?.id;

      if (id) {
        methodIdByKind[kind] = id;
      }
    }

    const configuredQueries = (config?.searchQueries ?? []).map((x) => x.trim()).filter((x) => x.length > 0);
    let searchQueries: string[];

    if (configuredQueries.length > 0) {
      searchQueries = configuredQueries.slice(0, MCP_TOOL_EXAMPLE_SEARCH_QUERY_LIMIT);
    } else {
      const creates = callModelMethods.filter((x) => x.call === 'create' && !hasNonDefaultSpecifier(x));
      const createMethod = creates.find((x) => x.modelType !== exampleMethod?.modelType) ?? creates[0];
      const queries = [exampleMethod, createMethod].map((x) => (x ? mcpMethodExampleSearchQuery(x) : undefined)).filter((x): x is string => Boolean(x));
      searchQueries = Array.from(new Set(queries)).slice(0, MCP_TOOL_EXAMPLE_SEARCH_QUERY_LIMIT);
    }

    const modelType = config?.modelType ?? exampleMethod?.modelType;

    result = {
      ...(methodId ? { methodId } : undefined),
      methodIdByKind,
      searchQueries,
      ...(modelType ? { modelType } : undefined)
    };
  }

  return result;
}

/**
 * Derives a short search query for a method: a verb (the first non-stop-word of the specifier, else the call) followed
 * by up to the last two words of the model type, with a noun equal to the verb dropped.
 *
 * @param method - The method.
 * @returns The query, or undefined when the method has no model type or call.
 *
 * @example
 * ```ts
 * mcpMethodExampleSearchQuery({ modelType: 'guestbookEntry', call: 'update', specifier: 'like', ... }); // 'like guestbook entry'
 * mcpMethodExampleSearchQuery({ modelType: 'formSpace', call: 'create', ... }); // 'create form space'
 * ```
 */
export function mcpMethodExampleSearchQuery(method: McpMethodSummary): Maybe<string> {
  let result: Maybe<string>;

  if (method.modelType && method.call) {
    const specifierWords = hasNonDefaultSpecifier(method) ? splitSearchIdentifierWords(method.specifier as string) : [];
    const verb = specifierWords.find((x) => !RANKED_SEARCH_ENGLISH_STOP_WORDS.has(x)) ?? splitSearchIdentifierWords(method.call)[0];
    const nouns = splitSearchIdentifierWords(method.modelType)
      .slice(-2)
      .filter((x) => x !== verb);
    const words = [verb, ...nouns].filter((x): x is string => Boolean(x)).slice(0, 3);
    result = words.length > 0 ? words.join(' ') : undefined;
  }

  return result;
}

// MARK: Warnings
/**
 * Input for {@link findMcpToolExamplesConfigWarnings}.
 */
export interface FindMcpToolExamplesConfigWarningsInput {
  readonly config?: Maybe<McpToolExamplesConfig | false>;
  readonly registry: Pick<McpMethodRegistry, 'resolveForSelector'>;
  readonly models?: Maybe<readonly McpManifestModelEntry[]>;
  readonly enums?: Maybe<{ readonly [name: string]: McpManifestEnum }>;
}

/**
 * Returns one boot warning for each configured example that does not resolve: a `methodId` no registered method
 * matches, or a `modelType` / `enumName` missing from the loaded manifest. A check is skipped when its catalog was not
 * loaded.
 *
 * @param input - The configured examples, the method registry, and the loaded manifests.
 * @returns The warning lines.
 */
export function findMcpToolExamplesConfigWarnings(input: FindMcpToolExamplesConfigWarningsInput): string[] {
  const { config, registry, models, enums } = input;
  const warnings: string[] = [];

  if (config) {
    if (config.methodId && registry.resolveForSelector(config.methodId) == null) {
      warnings.push(`tools.examples.methodId "${config.methodId}" does not match a registered method.`);
    }

    if (config.modelType && models && !models.some((x) => x.modelType === config.modelType)) {
      warnings.push(`tools.examples.modelType "${config.modelType}" is not in the loaded MCP manifest.`);
    }

    if (config.enumName && enums && enums[config.enumName] == null) {
      warnings.push(`tools.examples.enumName "${config.enumName}" is not in the loaded MCP manifest enums.`);
    }
  }

  return warnings;
}

// MARK: Text
/**
 * Formats up to `limit` example values as a quoted, " or "-joined list, e.g. `"a" or "b"`.
 *
 * @param values - The values.
 * @param quote - The quote character.
 * @returns The list, or undefined when there are no values.
 */
export function mcpToolExampleList(values: Maybe<readonly string[]>, quote = '"'): Maybe<string> {
  return values && values.length > 0 ? values.map((x) => `${quote}${x}${quote}`).join(' or ') : undefined;
}
