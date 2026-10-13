import { type Maybe } from '@dereekb/util';
import { mcpManifestKey } from './mcp.manifest';
import { type McpToolDefinition, type McpToolDispatchTarget } from './mcp.tool-generator';

/**
 * Which compact tool may run a method.
 *
 * `read` iff the method's effective read-only classification is `true` (the same fail-safe that drives
 * `readOnlyHint` and the module `readOnly` mode); everything else, including an unmarked `invoke`, is a `write`.
 */
export type McpMethodKind = 'read' | 'write';

/**
 * Where a method came from.
 *
 * - `callModel` — generated from a callModel handler.
 * - `builtin` — a built-in static tool (`model-get`, `whoami`, `batch-execute`, …).
 * - `additional` — an app-supplied tool registered through `MCP_ADDITIONAL_TOOLS`.
 */
export type McpMethodSource = 'callModel' | 'builtin' | 'additional';

/**
 * The public summary of one method, used by {@link McpMethodToolSelector} predicates and the compact `search` tool.
 */
export interface McpMethodSummary {
  /**
   * Canonical method id. `modelType.call` / `modelType.call.specifier` for callModel methods (e.g.
   * `worker.create`, `jobWorkerTimesheet.update.reopen`); the tool name for built-in and additional methods.
   */
  readonly id: string;
  /**
   * Alternate names that also resolve to this method: the legacy per-method tool name and the manifest-key form.
   */
  readonly aliases: readonly string[];
  readonly kind: McpMethodKind;
  readonly source: McpMethodSource;
  readonly modelType?: string;
  readonly call?: string;
  readonly specifier?: string;
}

/**
 * Picks which methods are also advertised as their own (legacy, per-method) tools.
 *
 * A list promotes methods by id or alias; a predicate is checked against every method at boot.
 */
export type McpMethodToolSelector = readonly string[] | ((method: McpMethodSummary) => boolean);

/**
 * One registered method: its summary plus the tool definition that executes it.
 */
export interface McpMethod extends McpMethodSummary {
  readonly definition: McpToolDefinition;
}

/**
 * Builds the canonical method id for a callModel dispatch target.
 *
 * @param dispatch - The dispatch coordinates.
 * @returns `modelType.call` for the default specifier, otherwise `modelType.call.specifier`.
 *
 * @example
 * ```ts
 * mcpMethodIdForDispatch({ modelType: 'worker', call: 'create' }); // 'worker.create'
 * ```
 */
export function mcpMethodIdForDispatch(dispatch: McpToolDispatchTarget): string {
  const { modelType, call, specifier } = dispatch;
  return specifier == null || specifier === '_' ? `${modelType}.${call}` : `${modelType}.${call}.${specifier}`;
}

/**
 * Normalizes a caller-supplied method name for lookup: trims whitespace and lowercases it.
 *
 * @param input - The method id or alias supplied by the caller.
 * @returns The lookup key.
 */
export function normalizeMcpMethodId(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Returns the {@link McpMethodKind} of a tool definition.
 *
 * @param definition - The tool definition.
 * @returns `read` when the definition is effectively read-only, otherwise `write`.
 */
export function mcpMethodKindForDefinition(definition: McpToolDefinition): McpMethodKind {
  return definition.filterMetadata.effectiveReadOnly === true ? 'read' : 'write';
}

/**
 * One input entry for {@link buildMcpMethodRegistry}.
 */
export interface McpMethodRegistryInputEntry {
  readonly definition: McpToolDefinition;
  readonly source: McpMethodSource;
}

/**
 * Per-request view of the methods a caller may see. All compact-tool resolution goes through a view, never the
 * boot registry, so a hidden method is indistinguishable from an unknown one.
 */
export interface McpMethodView {
  /**
   * The visible methods, in registry order.
   */
  readonly methods: readonly McpMethod[];
  /**
   * Resolves a method by id or alias (case-insensitive) among the visible methods.
   *
   * @param nameOrAlias - The method id or alias.
   * @returns The visible method, or `undefined` when it is unknown or hidden.
   */
  resolve(nameOrAlias: string): Maybe<McpMethod>;
  /**
   * Whether the method is part of this view.
   *
   * @param method - The method to check.
   */
  has(method: McpMethod): boolean;
}

/**
 * Boot-time registry of every method candidate.
 */
export interface McpMethodRegistry {
  readonly methods: readonly McpMethod[];
  /**
   * Alias collisions dropped while building the registry, described for a boot log line.
   */
  readonly warnings: readonly string[];
  /**
   * Returns the method registered for a definition (by reference).
   *
   * @param definition - The tool definition.
   */
  forDefinition(definition: McpToolDefinition): Maybe<McpMethod>;
  /**
   * Resolves a list selector entry (id or alias) at boot. Never use this for request-time resolution.
   *
   * @param nameOrAlias - The id or alias.
   */
  resolveForSelector(nameOrAlias: string): Maybe<McpMethod>;
  /**
   * Builds the per-request view over the caller's visible definitions. A definition the registry does not know
   * (e.g. the request-scoped `batch-execute` tool) is added as a `builtin` method named after the tool.
   *
   * @param visible - The caller's visible definitions.
   */
  view(visible: Iterable<McpToolDefinition>): McpMethodView;
}

/**
 * Builds the {@link McpMethod} for a definition.
 *
 * @param entry - The definition and its source.
 * @returns The method, with its id and candidate aliases (not yet de-duplicated).
 */
function buildMcpMethod(entry: McpMethodRegistryInputEntry): McpMethod {
  const { definition, source } = entry;
  const kind = mcpMethodKindForDefinition(definition);
  let result: McpMethod;

  if (source === 'callModel') {
    const { modelType, call, specifier } = definition.dispatch;
    const id = mcpMethodIdForDispatch(definition.dispatch);
    const aliases = [definition.name, mcpManifestKey(modelType, call, specifier)].filter((alias) => alias !== id);
    result = { id, aliases, kind, source, modelType, call, ...(specifier == null ? undefined : { specifier }), definition };
  } else {
    result = { id: definition.name, aliases: [], kind, source, definition };
  }

  return result;
}

/**
 * Builds the boot-time method registry.
 *
 * Ids win over aliases: an alias that collides with any id, or with another method's alias, is dropped (with a
 * warning) and the method stays reachable by its id. A later method whose id collides with an earlier one is dropped.
 *
 * @param entries - The method candidates, in precedence order.
 * @returns The registry.
 */
export function buildMcpMethodRegistry(entries: Iterable<McpMethodRegistryInputEntry>): McpMethodRegistry {
  const candidates: McpMethod[] = [];
  const idOwners = new Map<string, McpMethod>();
  const warnings: string[] = [];

  for (const entry of entries) {
    const method = buildMcpMethod(entry);
    const key = normalizeMcpMethodId(method.id);

    if (idOwners.has(key)) {
      warnings.push(`MCP method "${method.id}" collides with another method id and was dropped.`);
    } else {
      idOwners.set(key, method);
      candidates.push(method);
    }
  }

  // Count alias claims so an alias shared by two methods is dropped from both.
  const aliasClaims = new Map<string, number>();

  for (const method of candidates) {
    for (const alias of new Set(method.aliases.map(normalizeMcpMethodId))) {
      aliasClaims.set(alias, (aliasClaims.get(alias) ?? 0) + 1);
    }
  }

  const lookup = new Map<string, McpMethod>(idOwners);
  const methods: McpMethod[] = [];
  const byDefinition = new Map<McpToolDefinition, McpMethod>();

  for (const method of candidates) {
    const aliases: string[] = [];

    for (const alias of method.aliases) {
      const key = normalizeMcpMethodId(alias);

      if (idOwners.has(key) || (aliasClaims.get(key) ?? 0) > 1) {
        warnings.push(`MCP method alias "${alias}" of "${method.id}" is ambiguous and was dropped; call it by its id.`);
      } else if (!aliases.includes(alias)) {
        aliases.push(alias);
      }
    }

    const finalMethod: McpMethod = aliases.length === method.aliases.length ? method : { ...method, aliases };

    for (const alias of aliases) {
      lookup.set(normalizeMcpMethodId(alias), finalMethod);
    }

    lookup.set(normalizeMcpMethodId(finalMethod.id), finalMethod);
    methods.push(finalMethod);
    byDefinition.set(finalMethod.definition, finalMethod);
  }

  return {
    methods,
    warnings,
    forDefinition: (definition) => byDefinition.get(definition),
    resolveForSelector: (nameOrAlias) => lookup.get(normalizeMcpMethodId(nameOrAlias)),
    view: (visible) => {
      const viewMethods: McpMethod[] = [];

      for (const definition of visible) {
        viewMethods.push(byDefinition.get(definition) ?? buildMcpMethod({ definition, source: 'builtin' }));
      }

      const viewSet = new Set(viewMethods);
      const viewLookup = new Map<string, McpMethod>();

      for (const method of viewMethods) {
        for (const alias of method.aliases) {
          viewLookup.set(normalizeMcpMethodId(alias), method);
        }
      }

      // Ids are written last so an id always wins over an alias of another visible method.
      for (const method of viewMethods) {
        viewLookup.set(normalizeMcpMethodId(method.id), method);
      }

      return {
        methods: viewMethods,
        resolve: (nameOrAlias) => viewLookup.get(normalizeMcpMethodId(nameOrAlias)),
        has: (method) => viewSet.has(method)
      };
    }
  };
}

/**
 * Projects a method to its public summary (drops the definition).
 *
 * @param method - The method.
 * @returns The summary.
 */
export function mcpMethodSummary(method: McpMethod): McpMethodSummary {
  const { definition: _definition, ...summary } = method;
  return summary;
}
