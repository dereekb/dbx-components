import { type FirestoreModelType, type OidcModelScopeRequirement, type OidcScopeTerm, type OnCallTypedModelParams, CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, callModelOidcScopeForCallType, oidcScopeTermSatisfied, oidcScopeTermsSatisfied, resolveEffectiveOidcScopeTerms } from '@dereekb/firebase';
import { type AssertModelCrudRequestFunction, forbiddenError } from '@dereekb/firebase-server';
import { getOidcScopesFromRequest } from './service/oidc.auth';

/**
 * Configuration for {@link oidcCallModelScopePreAssert}.
 *
 * Both fields are optional. With NEITHER supplied, enforcement is byte-for-byte identical to the
 * behavior before this option existed: the per-verb `model.<call>` scope AND any per-function
 * `requiredScope` (a single per-function scope stays a plain additive AND).
 */
export interface OidcCallModelScopePreAssertConfig {
  /**
   * Group term required on EVERY callModel op unless a finer term overrides it (the per-function
   * `requiredScope`, then a {@link OidcCallModelScopePreAssertConfig.modelRequiredScopes} entry).
   * Lets an app require e.g. `'hellosubs'` across all models without editing individual handlers.
   */
  readonly defaultRequiredScope?: OidcScopeTerm;
  /**
   * Per-model group-term overrides consulted in the pre-assert, keyed by {@link FirestoreModelType}.
   * The ONLY place a plain read (which has no per-function handler) can be scope-gated. A verb-keyed
   * entry can require different terms per verb (e.g. `lms` reads, `hellosubs` writes).
   */
  readonly modelRequiredScopes?: Record<FirestoreModelType, OidcModelScopeRequirement>;
}

/**
 * Builds a {@link AssertModelCrudRequestFunction} that rejects callModel requests lacking the
 * required OIDC scope(s) for the call.
 *
 * Enforcement is AND-of-ORs across two terms:
 * - the per-verb scope mapped from the call type (`model.<call>`), and
 * - the effective GROUP term, resolved by precedence: the per-function `requiredScope` declared via
 *   `withApiDetails` (finest) > a per-model entry in {@link OidcCallModelScopePreAssertConfig.modelRequiredScopes}
 *   (verb-resolved; the only tagging point for a plain read) > {@link OidcCallModelScopePreAssertConfig.defaultRequiredScope}.
 *
 * A term is satisfied when the caller holds the scope (single-scope term) or ANY member (OR-group).
 * The composition and evaluation are shared with the MCP tool-visibility filter (via
 * `resolveEffectiveOidcScopeTerms` / `oidcScopeTermsSatisfied`) so enforcement and tool visibility
 * never drift.
 *
 * With NO config supplied, behavior is byte-for-byte identical to before this option existed: the
 * per-verb scope AND any single per-function `requiredScope`. demo/advisorey and the downstream prod
 * ramp rely on this.
 *
 * Bypasses the check (no-op) when the request is not OIDC-authenticated — i.e. when
 * {@link getOidcScopesFromRequest} returns `undefined` because there is no `auth.token.scope` claim
 * on the request. Regular Firebase ID-token callers are unaffected and continue to be gated by auth
 * roles.
 *
 * Short-circuits (without reading scopes) for a call that resolves no requirement at all — a custom
 * (non-CRUD) verb with no per-function/model/default term stays unrestricted unless an app wires its
 * own assertion.
 *
 * Relocation note: the authoritative home for callModel OIDC scope enforcement — and the ONLY gate
 * that also covers the `ModelApiController` `/get` direct-read path — is now the model-api layer
 * (`ModelApiCallModelDispatchService` / `ModelApiGetService`, configured via
 * `ModelApiDispatchConfig.defaultRequiredScope` / `modelRequiredScopes`). This pre-assert is retained
 * as a supported back-compat gate on the shared callModel function; it rides that function even though
 * the same function also serves the app's first-party Firebase `onCall` path (a no-op there — non-OIDC
 * callers bypass). Configure GROUP requirements on the model-api module, not here.
 *
 * Wire as the `preAssert` of {@link onCallModel}.
 *
 * @param config - Optional default + per-model group-term requirements. Omit for the additive
 *   per-verb + per-function behavior.
 * @returns The pre-assertion function ready to plug into `OnCallModelConfig.preAssert`.
 */
export function oidcCallModelScopePreAssert(config?: OidcCallModelScopePreAssertConfig): AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams> {
  const defaultRequiredScope = config?.defaultRequiredScope;
  const modelRequiredScopes = config?.modelRequiredScopes;

  const fn: AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams> = (context) => {
    // AND-ed terms: the per-verb model.<call> scope plus the effective group term (per-function >
    // model-level > default). Nullish/empty terms drop, so a custom verb with no requirement yields
    // an empty list and short-circuits without reading scopes — and, with no config + no per-function
    // scope, this list matches the pre-grouping behavior exactly.
    const terms = resolveEffectiveOidcScopeTerms({
      perVerbScope: callModelOidcScopeForCallType(context.call),
      requiredScope: context.requiredScope,
      modelRequirement: modelRequiredScopes?.[context.modelType],
      call: context.call,
      defaultRequiredScope
    });

    // A non-OIDC caller yields `undefined` scopes below and bypasses, exactly like the per-verb check.
    const grantedScopes = terms.length === 0 ? undefined : getOidcScopesFromRequest(context.request);

    if (grantedScopes != null && !oidcScopeTermsSatisfied(terms, grantedScopes)) {
      const missingTerms = terms.filter((term) => !oidcScopeTermSatisfied(term, grantedScopes));
      throw forbiddenError({
        status: 403,
        code: CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE,
        message: `Missing required OIDC scope for callModel: ${missingTerms.map(formatScopeTerm).join(', ')}`,
        data: { requiredScopes: missingTerms, call: context.call }
      });
    }
  };

  return fn;
}

/**
 * Renders a scope term for the human-readable error message: a single scope as-is, an OR-group as its
 * alternatives joined by `|` (so a single-scope term reads exactly as before).
 *
 * @param term - The unsatisfied scope term.
 * @returns The display string for the term.
 */
function formatScopeTerm(term: OidcScopeTerm): string {
  return typeof term === 'string' ? term : term.join('|');
}
