import { type Maybe } from '@dereekb/util';
import { callModelOidcScopeForCallType, type CallModelOidcScope, type OidcScopeTerm } from '@dereekb/firebase';
import { type McpEscalatingParamHints, type McpToolVisibility, type McpVisibilityContext, type McpVisibilityRule } from '@dereekb/firebase-server';
import type { ToolAnnotations } from '@modelcontextprotocol/server';

/**
 * Normalized classification of a {@link McpToolVisibility} value computed at boot.
 *
 * `'always'` keeps the tool (subject to scope/readOnly filters).
 * `'never'` drops the tool from `tools/list` entirely — partitioned at boot so the per-request loop skips it.
 * `'declarative'` carries a {@link McpVisibilityRule} checked per request without invoking user code.
 * `'dynamic'` carries the original predicate; invoked per request inside try/catch.
 */
export type McpToolVisibilityKind = 'always' | 'never' | 'declarative' | 'dynamic';

/**
 * Boot-time classification result for one tool's `visibility` field.
 *
 * Discriminated by {@link McpToolVisibilityKind} so consumers can narrow `rule` /
 * `visibilityFn` presence without optional-chain assertions.
 */
export type ClassifiedMcpToolVisibility = ClassifiedMcpToolVisibilityAlways | ClassifiedMcpToolVisibilityNever | ClassifiedMcpToolVisibilityDeclarative | ClassifiedMcpToolVisibilityDynamic;

export interface ClassifiedMcpToolVisibilityAlways {
  readonly visibilityKind: 'always';
}

export interface ClassifiedMcpToolVisibilityNever {
  readonly visibilityKind: 'never';
}

export interface ClassifiedMcpToolVisibilityDeclarative {
  readonly visibilityKind: 'declarative';
  readonly rule: McpVisibilityRule;
}

export interface ClassifiedMcpToolVisibilityDynamic {
  readonly visibilityKind: 'dynamic';
  readonly visibilityFn: (context: McpVisibilityContext) => boolean;
}

/**
 * Per-tool boot-time filter metadata. The per-request loop reads these fields directly.
 *
 * Discriminated by {@link McpToolVisibilityKind} so the request loop narrows to the
 * exact variant carrying `rule` or `visibilityFn` without optional-chain assertions.
 */
export type McpToolFilterMetadata = McpToolFilterMetadataAlways | McpToolFilterMetadataNever | McpToolFilterMetadataDeclarative | McpToolFilterMetadataDynamic;

interface McpToolFilterMetadataBase {
  /**
   * OIDC scope TERMS required to invoke this tool, evaluated AND-of-ORs — the caller must satisfy
   * EVERY term, and an array term (OR-group) is satisfied by holding ANY member. Checked with the
   * shared `oidcScopeTermsSatisfied` so tool-list visibility matches the server-side `callModel` gate
   * exactly. Precomputed from the dispatch call type's per-verb scope (`model.<call>`) plus the
   * effective group term (per-function `requiredScope` > per-model requirement > module default).
   * Empty when no scope is enforced (a non-CRUD call type with no per-function/model/default term);
   * apps gate custom verbs via their own preAssert.
   */
  readonly requiredScopeTerms?: readonly OidcScopeTerm[];
  /**
   * Effective read-only classification used by the module-level `readOnly` filter.
   *
   * Explicit handler `mcp.readOnly` wins. Otherwise inferred from the call type:
   * `read`/`query` → true; `create`/`update`/`delete` → false; anything else → undefined.
   * Unknown counts as a write for fail-safe filtering.
   */
  readonly effectiveReadOnly?: boolean;
  /**
   * Destructive classification of a call that sets no escalating param. Only meaningful when `effectiveReadOnly` is not true.
   *
   * Explicit `mcp.destructive` wins; otherwise inferred from the call type (`create` → false, everything else → true).
   * `undefined` on a read-only tool and on an unclassified static write, which counts as destructive (fail-safe).
   */
  readonly effectiveDestructive?: boolean;
  /**
   * The explicit `mcp.openWorld`, when set.
   */
  readonly openWorld?: boolean;
}

export interface McpToolFilterMetadataAlways extends McpToolFilterMetadataBase {
  readonly visibilityKind: 'always';
}

export interface McpToolFilterMetadataNever extends McpToolFilterMetadataBase {
  readonly visibilityKind: 'never';
}

export interface McpToolFilterMetadataDeclarative extends McpToolFilterMetadataBase {
  readonly visibilityKind: 'declarative';
  readonly rule: McpVisibilityRule;
}

export interface McpToolFilterMetadataDynamic extends McpToolFilterMetadataBase {
  readonly visibilityKind: 'dynamic';
  readonly visibilityFn: (context: McpVisibilityContext) => boolean;
}

/**
 * Classifies a {@link McpToolVisibility} value into its normalized boot-time form.
 *
 * Defaults `undefined` to `'always'` so handlers without a visibility field stay visible.
 *
 * @param visibility - The raw visibility value from the handler's `mcp.visibility` field.
 * @returns The discriminated classification used by the per-request filter loop.
 */
export function classifyVisibility(visibility?: McpToolVisibility): ClassifiedMcpToolVisibility {
  let result: ClassifiedMcpToolVisibility;

  if (visibility == null || visibility === true) {
    result = { visibilityKind: 'always' };
  } else if (visibility === false) {
    result = { visibilityKind: 'never' };
  } else if (typeof visibility === 'function') {
    result = { visibilityKind: 'dynamic', visibilityFn: visibility };
  } else {
    result = { visibilityKind: 'declarative', rule: visibility };
  }

  return result;
}

/**
 * Inference table from CRUD call type to "is this a read operation?".
 *
 * `read` and `query` → true. `create`/`update`/`delete` → false. Anything else → undefined.
 * Unknown call types (custom verbs, `invoke`) intentionally leave `effectiveReadOnly`
 * undefined so the module-level `readOnly` filter treats them as writes (fail-safe).
 */
const READ_ONLY_BY_CALL_TYPE: Readonly<Record<string, boolean | undefined>> = {
  read: true,
  query: true,
  create: false,
  update: false,
  delete: false
};

/**
 * Resolves the effective read-only classification for a handler.
 *
 * Explicit handler override wins. Otherwise infers from the call type. Returns
 * `undefined` when neither source provides a definite classification.
 *
 * @param explicitReadOnly - The handler's explicit `mcp.readOnly` value, if any.
 * @param callType - The dispatch call type used to infer read-only when no override is present.
 * @returns The effective read-only flag, or `undefined` when neither source resolves a value.
 */
export function resolveEffectiveReadOnly(explicitReadOnly: Maybe<boolean>, callType: string): boolean | undefined {
  if (explicitReadOnly != null) {
    return explicitReadOnly;
  }

  return READ_ONLY_BY_CALL_TYPE[callType];
}

/**
 * The resolved MCP hints of a tool, or of one call of it.
 */
export interface McpToolHints {
  /**
   * Effective read-only classification. `undefined` is unclassified and treated as a write.
   */
  readonly readOnly?: Maybe<boolean>;
  /**
   * Whether a call that is not read-only may delete or overwrite data. `undefined` is unclassified and treated as destructive.
   */
  readonly destructive?: Maybe<boolean>;
  /**
   * Whether the call reaches outside the app. `undefined` advertises no `openWorldHint` and routes as `false`.
   */
  readonly openWorld?: Maybe<boolean>;
}

/**
 * Inference table from call type to "may this call destroy data?", used when `mcp.destructive` is unset on a call that is
 * not read-only. `create` → false (additive); `update` / `delete` → true; any other call type (`invoke`, custom verbs)
 * falls back to true (fail-safe) in {@link resolveEffectiveDestructive}.
 */
const DESTRUCTIVE_BY_CALL_TYPE: Readonly<Record<string, boolean>> = {
  create: false,
  update: true,
  delete: true
};

/**
 * Resolves whether a call that is not read-only may delete or overwrite data.
 *
 * Explicit handler override wins. Otherwise infers from the call type, failing safe to `true` for `invoke` and custom verbs.
 *
 * @param explicitDestructive - The handler's explicit `mcp.destructive` value, if any.
 * @param callType - The dispatch call type used to infer the classification when no override is present.
 * @returns Whether the call may delete or overwrite data.
 */
export function resolveEffectiveDestructive(explicitDestructive: Maybe<boolean>, callType: string): boolean {
  return explicitDestructive ?? DESTRUCTIVE_BY_CALL_TYPE[callType] ?? true;
}

/**
 * Raises base hints by escalations: a hint any escalation sets wins. Used for the worst case a tool advertises, and for the
 * kind of a call that sets one escalating param.
 *
 * @param base - The hints of a call that sets no escalating param.
 * @param escalations - The hints of each escalating param to apply.
 * @returns The raised hints. `readOnly` passes through unchanged.
 */
export function mergeMcpToolHints(base: McpToolHints, escalations: Iterable<McpEscalatingParamHints>): McpToolHints {
  let destructive = base.destructive;
  let openWorld = base.openWorld;

  for (const escalation of escalations) {
    if (escalation.destructive === true) {
      destructive = true;
    }

    if (escalation.openWorld === true) {
      openWorld = true;
    }
  }

  return { readOnly: base.readOnly, destructive, openWorld };
}

/**
 * Maps resolved hints to the standard MCP {@link ToolAnnotations} advertised on `tools/list`.
 *
 * A definitively read-only tool advertises `{ readOnlyHint: true }`. Everything else advertises
 * `{ readOnlyHint: false, destructiveHint }`, where an unclassified `destructive` fails safe to `true` so a client never
 * mistakes an ambiguous tool for a safe one. `openWorldHint` is added only when `openWorld` is set. `idempotentHint` stays
 * unset.
 *
 * Co-located with {@link resolveEffectiveReadOnly} / {@link READ_ONLY_BY_CALL_TYPE} so the
 * read/write classification rules stay in one file.
 *
 * @param hints - The resolved hints of the tool.
 * @returns The MCP annotations describing the tool's behaviour.
 */
export function resolveMcpToolAnnotations(hints: McpToolHints): ToolAnnotations {
  const annotations: ToolAnnotations = hints.readOnly === true ? { readOnlyHint: true } : { readOnlyHint: false, destructiveHint: hints.destructive !== false };
  return hints.openWorld == null ? annotations : { ...annotations, openWorldHint: hints.openWorld };
}

/**
 * Resolves the OIDC scope required to invoke a given call type, or `undefined` for
 * non-CRUD calls. Thin re-export so the tool generator doesn't need to reach into
 * `@dereekb/firebase` directly.
 *
 * @param callType - The dispatch call type to map to a CRUD OIDC scope.
 * @returns The required scope for this call type, or `undefined` when no scope is enforced.
 */
export function resolveRequiredScope(callType: string): Maybe<CallModelOidcScope> {
  return callModelOidcScopeForCallType(callType);
}
