import { type Maybe } from '@dereekb/util';
import { type McpEscalatingParamHints } from '@dereekb/firebase-server';
import { mcpManifestKey } from './mcp.manifest';
import { type McpToolDefinition, type McpToolDispatchTarget } from './mcp.tool-generator';
import { mergeMcpToolHints, type McpToolHints } from './mcp.visibility';

/**
 * Which compact tool may run a method, or one call of it.
 *
 * - `read` — the effective read-only classification is `true` (the same fail-safe that drives `readOnlyHint` and the
 *   module `readOnly` mode).
 * - `destructive` — the method may delete or overwrite data, or is open-world. An unmarked `invoke` or custom verb lands
 *   here (fail-safe).
 * - `write` — everything else that changes data.
 */
export type McpMethodKind = 'read' | 'write' | 'destructive';

/**
 * Every {@link McpMethodKind}, from least to most risky.
 */
export const MCP_METHOD_KINDS: readonly McpMethodKind[] = ['read', 'write', 'destructive'];

/**
 * Whether a value is a {@link McpMethodKind}.
 *
 * @param value - The value to check.
 * @returns `true` when the value is one of {@link MCP_METHOD_KINDS}.
 */
export function isMcpMethodKind(value: unknown): value is McpMethodKind {
  return (MCP_METHOD_KINDS as readonly unknown[]).includes(value);
}

/**
 * One escalating param of a method, resolved at boot.
 */
export interface McpMethodEscalatingParam {
  readonly param: string;
  /**
   * The kind of a call that sets this param.
   */
  readonly kind: McpMethodKind;
  readonly hints: McpEscalatingParamHints;
}

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
   * `guestbook.create`, `guestbook.update.subscribeToNotifications`); the tool name for built-in and additional methods.
   */
  readonly id: string;
  /**
   * Alternate names that also resolve to this method: the legacy per-method tool name and the manifest-key form.
   */
  readonly aliases: readonly string[];
  /**
   * The kind of a call that sets none of {@link escalatingParams}.
   */
  readonly kind: McpMethodKind;
  readonly source: McpMethodSource;
  readonly modelType?: string;
  readonly call?: string;
  readonly specifier?: string;
  /**
   * The params that change a call's kind when set, in declaration order. Omitted when the method has none.
   */
  readonly escalatingParams?: readonly McpMethodEscalatingParam[];
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
 * mcpMethodIdForDispatch({ modelType: 'guestbook', call: 'create' }); // 'guestbook.create'
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
 * Returns the base hints of a tool definition: those of a call that sets no escalating param.
 *
 * @param definition - The tool definition.
 * @returns The hints read from the definition's filter metadata.
 */
export function mcpToolBaseHints(definition: McpToolDefinition): McpToolHints {
  const { effectiveReadOnly, effectiveDestructive, openWorld } = definition.filterMetadata;
  return { readOnly: effectiveReadOnly, destructive: effectiveDestructive, openWorld };
}

/**
 * Returns the {@link McpMethodKind} for resolved hints.
 *
 * @param hints - The hints of a method or one call of it.
 * @returns `read` when read-only; `destructive` when destructive (or unclassified) or open-world; otherwise `write`.
 */
export function mcpMethodKindForHints(hints: McpToolHints): McpMethodKind {
  let kind: McpMethodKind;

  if (hints.readOnly === true) {
    kind = 'read';
  } else if (hints.destructive !== false || hints.openWorld === true) {
    kind = 'destructive';
  } else {
    kind = 'write';
  }

  return kind;
}

/**
 * Returns the {@link McpMethodKind} of a tool definition, for a call that sets no escalating param.
 *
 * @param definition - The tool definition.
 * @returns The definition's base kind.
 */
export function mcpMethodKindForDefinition(definition: McpToolDefinition): McpMethodKind {
  return mcpMethodKindForHints(mcpToolBaseHints(definition));
}

/**
 * Returns every kind a call of the method can have: its base kind plus each escalating param's kind.
 *
 * @param method - The method.
 * @returns The unique kinds, in {@link MCP_METHOD_KINDS} order.
 */
export function mcpMethodKinds(method: McpMethodSummary): McpMethodKind[] {
  const kinds = new Set<McpMethodKind>([method.kind, ...(method.escalatingParams ?? []).map((x) => x.kind)]);
  return MCP_METHOD_KINDS.filter((kind) => kinds.has(kind));
}

/**
 * Whether an escalating param counts as set: any value other than `undefined`, `null` or `false`. `''`, `0` and `[]`
 * count as set.
 *
 * @param value - The param value.
 * @returns `true` when the param is set.
 */
export function isMcpEscalatingParamSet(value: unknown): boolean {
  return value != null && value !== false;
}

/**
 * The kind of one call of a method, from {@link mcpMethodKindForCall}.
 */
export interface McpMethodCallKind {
  readonly kind: McpMethodKind;
  /**
   * The set escalating params that raised the call above the method's base kind, in declaration order.
   */
  readonly escalatedBy: readonly string[];
}

/**
 * Returns the kind of one call of a method: its base kind, raised by any escalating param the call sets.
 *
 * Only own properties of `params` are read, so a param named after an `Object.prototype` member is never set by
 * inheritance.
 *
 * @param method - The method being called.
 * @param params - The call's params.
 * @returns The call's kind and the params that raised it.
 */
export function mcpMethodKindForCall(method: McpMethodSummary, params: Maybe<Readonly<Record<string, unknown>>>): McpMethodCallKind {
  const baseRank = MCP_METHOD_KINDS.indexOf(method.kind);
  const escalatedBy: string[] = [];
  let kind = method.kind;

  for (const escalation of method.escalatingParams ?? []) {
    const rank = MCP_METHOD_KINDS.indexOf(escalation.kind);

    if (rank > baseRank && params != null && Object.hasOwn(params, escalation.param) && isMcpEscalatingParamSet(params[escalation.param])) {
      escalatedBy.push(escalation.param);

      if (rank > MCP_METHOD_KINDS.indexOf(kind)) {
        kind = escalation.kind;
      }
    }
  }

  return { kind, escalatedBy };
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
  const baseHints = mcpToolBaseHints(definition);
  const kind = mcpMethodKindForHints(baseHints);
  const escalatingParamEntries = Object.entries(definition.escalatingParams ?? {});
  const escalatingParams = escalatingParamEntries.length > 0 ? { escalatingParams: escalatingParamEntries.map(([param, hints]): McpMethodEscalatingParam => ({ param, kind: mcpMethodKindForHints(mergeMcpToolHints(baseHints, [hints])), hints })) } : undefined;
  let result: McpMethod;

  if (source === 'callModel') {
    const { modelType, call, specifier } = definition.dispatch;
    const id = mcpMethodIdForDispatch(definition.dispatch);
    const aliases = [definition.name, mcpManifestKey(modelType, call, specifier)].filter((alias) => alias !== id);
    result = { id, aliases, kind, source, modelType, call, ...(specifier == null ? undefined : { specifier }), ...escalatingParams, definition };
  } else {
    result = { id: definition.name, aliases: [], kind, source, ...escalatingParams, definition };
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
