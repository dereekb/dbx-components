import { type Maybe } from '@dereekb/util';
import { type OidcEntryClientId } from '@dereekb/firebase';
import { type FirebaseServerAuthData, type FirebaseServerAuthenticatedRequest } from '@dereekb/firebase-server';

// MARK: Types
/**
 * Auth data attached to the request after successful OIDC bearer token verification.
 *
 * Extends {@link FirebaseServerAuthData} so it is compatible with the server auth pipeline.
 * The `accessToken` field carries OIDC-specific claims from the verified access token.
 */
export interface OidcAuthData extends FirebaseServerAuthData {
  /**
   * Claims from the verified OIDC access token.
   */
  readonly oidcValidatedToken: {
    readonly sub: string;
    readonly scope?: string;
    readonly client_id?: OidcEntryClientId;
    [key: string]: unknown;
  };
}

/**
 * Extends {@link FirebaseServerAuthenticatedRequest} with OIDC auth data.
 *
 * The `auth` field is populated by {@link OidcAuthBearerTokenMiddleware} after
 * successful bearer token verification.
 */
export type OidcAuthenticatedRequest = FirebaseServerAuthenticatedRequest<OidcAuthData>;

// MARK: Scopes
/**
 * Reads the set of OIDC scopes carried by a callable request's bearer token.
 *
 * The `ModelApiCallModelDispatchService` builds a synthetic `CallableRequest` with
 * `auth.token = oidcValidatedToken ?? {}`, so the OIDC scope string lives at
 * `request.auth.token.scope` for OIDC callers and is `undefined` for non-OIDC
 * (regular Firebase ID-token) callers.
 *
 * Returning `undefined` for non-OIDC callers lets callers (e.g. `oidcCallModelScopePreAssert`)
 * skip scope enforcement instead of falsely treating the missing claim as "no scopes granted".
 *
 * The parameter is intentionally typed as `unknown` because `DecodedIdToken` (Firebase
 * Auth's typed token shape) does not declare a `scope` field, while OIDC bearer-token
 * callers attach one at runtime. Reading is done defensively.
 *
 * @param request - The callable request as seen inside an `onCallModel` handler.
 * @returns A `Set<string>` of granted scopes, or `undefined` when the request carries no OIDC `scope` claim.
 */
export function getOidcScopesFromRequest(request: unknown): Maybe<Set<string>> {
  const scope = (request as { auth?: { token?: { scope?: unknown } } } | undefined)?.auth?.token?.scope;
  const result: Maybe<Set<string>> = typeof scope === 'string' ? new Set(scope.split(' ').filter((value) => value.length > 0)) : undefined;
  return result;
}
