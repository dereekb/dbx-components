import { type Maybe } from '@dereekb/util';
import { type OidcScope, type OidcScopeTerm, oidcScopeTermSatisfied, oidcScopesFromScopeClaim } from '@dereekb/firebase';
import { forbiddenError } from '../../function/error';
import { type FirebaseServerAuthData } from './auth.context.server';

/**
 * Error code thrown by {@link assertEndpointOidcScope} when an OIDC caller is missing the scope a
 * non-model endpoint requires.
 *
 * Distinct from the callModel-layer code so a client can tell "you cannot call this endpoint" apart
 * from "you cannot make this model call".
 */
export const MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE = 'MISSING_ENDPOINT_OIDC_SCOPE_ERROR';

/**
 * Reads the set of OIDC scopes carried by an authenticated request, or `undefined` for a non-OIDC
 * (regular Firebase ID-token) caller.
 *
 * The OIDC bearer-token middleware attaches the validated access-token claims at
 * `auth.oidcValidatedToken` (with the space-delimited `scope` string); a non-OIDC caller has neither
 * that field nor a `scope` on `auth.token`. Reading is defensive — the auth shape is only typed as
 * {@link FirebaseServerAuthData} here, since the OIDC-specific `oidcValidatedToken` lives in the
 * `@dereekb/firebase-server/oidc` sub-package this core layer cannot import — and the actual parse is
 * delegated to the shared {@link oidcScopesFromScopeClaim} so there is no drift with
 * `getOidcScopesFromRequest`.
 *
 * @param auth - The request auth data, or undefined for unauthenticated requests.
 * @returns The granted scope set, or `undefined` when the request carries no OIDC `scope` claim.
 */
export function oidcScopesFromRequestAuth(auth: Maybe<FirebaseServerAuthData>): Maybe<Set<OidcScope>> {
  const oidcScope = (auth as Maybe<{ oidcValidatedToken?: { scope?: unknown } }>)?.oidcValidatedToken?.scope;
  const tokenScope = (auth as Maybe<{ token?: { scope?: unknown } }>)?.token?.scope;
  const scope = oidcScope ?? tokenScope;
  return oidcScopesFromScopeClaim(scope);
}

/**
 * Inputs to {@link assertEndpointOidcScope}.
 */
export interface AssertEndpointOidcScopeInput {
  /**
   * The scope term the endpoint requires — a single scope, or an OR-group satisfied by holding any
   * one of its scopes. `undefined`/`null` imposes no requirement.
   */
  readonly requiredScope: Maybe<OidcScopeTerm>;
  /**
   * The scopes the caller was granted, or `undefined` for a non-OIDC caller (bypasses enforcement).
   */
  readonly grantedScopes: Maybe<ReadonlySet<OidcScope>>;
  /**
   * Human-readable endpoint identifier used in the thrown error message (e.g. `/api/session/firestore`).
   */
  readonly endpoint: string;
}

/**
 * Enforces a single OIDC scope requirement for a plain (non-callModel) endpoint, throwing a `403`
 * when an OIDC caller does not hold it.
 *
 * The non-model counterpart to `assertModelApiOidcScope`, which is unusable outside the model API
 * because it requires a `{ call, modelType }` pair. Evaluation reuses the same shipped
 * {@link oidcScopeTermSatisfied} primitive so a term means the same thing on both surfaces.
 *
 * Bypasses (no-op) when `grantedScopes` is `undefined` — i.e. a non-OIDC caller carrying a plain
 * Firebase ID token, which has no `scope` claim to enforce against. **This is why scope-gating alone
 * is never a sufficient gate**: an endpoint that must reject non-admins needs its own admin check,
 * with the scope acting as defence in depth.
 *
 * @param input - The required term, the caller's granted scopes, and the endpoint name for the message.
 * @throws A `403` forbidden error (code {@link MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE}) when an OIDC
 *   caller does not satisfy the requirement.
 */
export function assertEndpointOidcScope(input: AssertEndpointOidcScopeInput): void {
  const { requiredScope, grantedScopes, endpoint } = input;

  if (requiredScope != null && grantedScopes != null && !oidcScopeTermSatisfied(requiredScope, grantedScopes)) {
    const required = Array.isArray(requiredScope) ? requiredScope : [requiredScope as OidcScope];

    throw forbiddenError({
      status: 403,
      code: MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE,
      message: `Missing required OIDC scope for ${endpoint}: ${required.join(' | ')}`,
      data: { requiredScopes: required, endpoint }
    });
  }
}
