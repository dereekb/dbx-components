import { type Maybe } from '@dereekb/util';
import { type KnownOnCallFunctionType, type OnCallFunctionType, type OnCallTypedModelParams } from '@dereekb/firebase';
import { type AssertModelCrudRequestFunction, forbiddenError } from '@dereekb/firebase-server';
import { getOidcScopesFromRequest } from './service/oidc.auth';

/**
 * Prefix shared by every callModel OIDC scope (e.g., `model.create`).
 *
 * Kept stable so OAuth consent screens render consistent labels and so
 * future per-resource scopes (e.g., `model.create:profile`) compose cleanly.
 */
export const CALL_MODEL_OIDC_SCOPE_PREFIX = 'model.';

/**
 * Canonical CRUD scopes enforced on the `callModel` API.
 *
 * Each scope corresponds 1:1 to a {@link KnownOnCallFunctionType}; see
 * {@link CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE}.
 */
export const CALL_MODEL_OIDC_SCOPES = ['model.create', 'model.read', 'model.update', 'model.delete', 'model.query'] as const;

/**
 * Union of the five canonical callModel CRUD scope strings.
 */
export type CallModelOidcScope = (typeof CALL_MODEL_OIDC_SCOPES)[number];

/**
 * Maps each known CRUD call type to the scope an OIDC token must carry to invoke it.
 */
export const CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE: Readonly<Record<KnownOnCallFunctionType, CallModelOidcScope>> = {
  create: 'model.create',
  read: 'model.read',
  update: 'model.update',
  delete: 'model.delete',
  query: 'model.query'
};

/**
 * Resolves the OIDC scope that an OIDC-authenticated caller must hold to invoke
 * the given callModel `call` type.
 *
 * Returns `undefined` for non-CRUD (custom) call types so that scope enforcement
 * is opt-in for app-specific verbs — apps can still gate them via their own
 * `preAssert` if needed.
 *
 * @param call - The CRUD call type from {@link OnCallTypedModelParams.call}.
 * @returns The required scope, or `undefined` if `call` is not one of the known CRUD verbs.
 */
export function callModelOidcScopeForCallType(call: Maybe<OnCallFunctionType>): Maybe<CallModelOidcScope> {
  const result: Maybe<CallModelOidcScope> = call == null ? undefined : CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE[call as KnownOnCallFunctionType];
  return result;
}

/**
 * Error code used when an OIDC-authenticated caller is missing the required
 * `model.*` scope for a callModel CRUD operation.
 */
export const CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE = 'CALL_MODEL_MISSING_OIDC_SCOPE';

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
