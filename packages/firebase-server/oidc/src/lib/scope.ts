import { type OnCallTypedModelParams, CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, callModelOidcScopeForCallType } from '@dereekb/firebase';
import { type AssertModelCrudRequestFunction, forbiddenError } from '@dereekb/firebase-server';
import { getOidcScopesFromRequest } from './service/oidc.auth';

/**
 * Builds a {@link AssertModelCrudRequestFunction} that rejects callModel requests
 * lacking the OIDC scope mapped from the call type.
 *
 * Bypasses the check (no-op) when the request is not OIDC-authenticated — i.e.
 * when {@link getOidcScopesFromRequest} returns `undefined` because there is no
 * `auth.token.scope` claim on the request. Regular Firebase ID-token callers are
 * unaffected and continue to be gated by auth roles.
 *
 * Bypasses the check for custom (non-CRUD) call types so app-specific verbs
 * remain unrestricted unless an app wires its own assertion.
 *
 * Wire as the `preAssert` of {@link onCallModel}.
 *
 * @returns The pre-assertion function ready to plug into `OnCallModelConfig.preAssert`.
 */
export function oidcCallModelScopePreAssert(): AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams> {
  const fn: AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams> = (context) => {
    const requiredScope = callModelOidcScopeForCallType(context.call);
    const scopes = requiredScope == null ? undefined : getOidcScopesFromRequest(context.request);
    const isMissingScope = requiredScope != null && scopes != null && !scopes.has(requiredScope);

    if (isMissingScope) {
      throw forbiddenError({
        status: 403,
        code: CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE,
        message: `Missing required OIDC scope for callModel: ${requiredScope}`,
        data: { requiredScope, call: context.call }
      });
    }
  };

  return fn;
}
