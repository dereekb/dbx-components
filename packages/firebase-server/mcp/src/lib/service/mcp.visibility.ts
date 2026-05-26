import { type Maybe } from '@dereekb/util';
import { callModelOidcScopeForCallType, type CallModelOidcScope } from '@dereekb/firebase';
import { type McpToolVisibility, type McpVisibilityContext, type McpVisibilityRule } from '@dereekb/firebase-server';

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
   * OIDC scope required to invoke this tool. Precomputed from the dispatch call type.
   * `undefined` for non-CRUD call types (apps gate those via their own preAssert if needed).
   */
  readonly requiredScope?: CallModelOidcScope;
  /**
   * Effective read-only classification used by the module-level `readOnly` filter.
   *
   * Explicit handler `mcp.readOnly` wins. Otherwise inferred from the call type:
   * `read`/`query` → true; `create`/`update`/`delete` → false; anything else → undefined.
   * Unknown counts as a write for fail-safe filtering.
   */
  readonly effectiveReadOnly?: boolean;
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
