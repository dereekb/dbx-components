import { type OnCallTypedModelParams, CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, callModelOidcScopeForCallType } from '@dereekb/firebase';
import { filterMaybeArrayValues } from '@dereekb/util';
import { type AssertModelCrudRequestFunction, forbiddenError } from '@dereekb/firebase-server';
import { getOidcScopesFromRequest } from './service/oidc.auth';

/**
 * Builds a {@link AssertModelCrudRequestFunction} that rejects callModel requests
 * lacking the required OIDC scope(s) for the call.
 *
 * Enforcement is additive: an OIDC caller must hold BOTH the per-verb scope mapped
 * from the call type (`model.<call>`) AND any per-function scope a handler declared
 * via `withApiDetails({ requiredScope })` — surfaced on `context.requiredScope`.
 *
 * Bypasses the check (no-op) when the request is not OIDC-authenticated — i.e.
 * when {@link getOidcScopesFromRequest} returns `undefined` because there is no
 * `auth.token.scope` claim on the request. Regular Firebase ID-token callers are
 * unaffected and continue to be gated by auth roles.
 *
 * Bypasses the check for custom (non-CRUD) call types that declare no per-function
 * scope, so app-specific verbs remain unrestricted unless an app wires its own
 * assertion or declares a `requiredScope`.
 *
 * Wire as the `preAssert` of {@link onCallModel}.
 *
 * @returns The pre-assertion function ready to plug into `OnCallModelConfig.preAssert`.
 */
export function oidcCallModelScopePreAssert(): AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams> {
  const fn: AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams> = (context) => {
    const requiredScopes = filterMaybeArrayValues([callModelOidcScopeForCallType(context.call), context.requiredScope]);
    // No requirement (custom verb + no per-function scope) short-circuits without reading scopes.
    // A non-OIDC caller yields `undefined` scopes below and bypasses just like the per-verb check.
    const scopes = requiredScopes.length === 0 ? undefined : getOidcScopesFromRequest(context.request);
    const missingScopes = scopes == null ? [] : requiredScopes.filter((scope) => !scopes.has(scope));

    if (missingScopes.length > 0) {
      throw forbiddenError({
        status: 403,
        code: CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE,
        message: `Missing required OIDC scope for callModel: ${missingScopes.join(', ')}`,
        data: { requiredScopes: missingScopes, call: context.call }
      });
    }
  };

  return fn;
}
