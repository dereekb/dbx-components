import { type LabeledValueWithDescription, type Maybe } from '@dereekb/util';
import { type KnownOnCallFunctionType, type OnCallFunctionType, type OnCallTypedModelParams } from '../../model/function';

/**
 * Prefix shared by every callModel OIDC scope (e.g., `model.create`).
 *
 * Kept stable so OAuth consent screens render consistent labels and so
 * future per-resource scopes (e.g., `model.create:profile`) compose cleanly.
 */
export const CALL_MODEL_OIDC_SCOPE_PREFIX = 'model.' as const;

export const CREATE_MODEL_OIDC_SCOPE = `${CALL_MODEL_OIDC_SCOPE_PREFIX}create` as const;
export const READ_MODEL_OIDC_SCOPE = `${CALL_MODEL_OIDC_SCOPE_PREFIX}read` as const;
export const UPDATE_MODEL_OIDC_SCOPE = `${CALL_MODEL_OIDC_SCOPE_PREFIX}update` as const;
export const DELETE_MODEL_OIDC_SCOPE = `${CALL_MODEL_OIDC_SCOPE_PREFIX}delete` as const;
export const QUERY_MODEL_OIDC_SCOPE = `${CALL_MODEL_OIDC_SCOPE_PREFIX}query` as const;
export const INVOKE_MODEL_OIDC_SCOPE = `${CALL_MODEL_OIDC_SCOPE_PREFIX}invoke` as const;

export type CreateModelOidcScope = typeof CREATE_MODEL_OIDC_SCOPE;
export type ReadModelOidcScope = typeof READ_MODEL_OIDC_SCOPE;
export type UpdateModelOidcScope = typeof UPDATE_MODEL_OIDC_SCOPE;
export type DeleteModelOidcScope = typeof DELETE_MODEL_OIDC_SCOPE;
export type QueryModelOidcScope = typeof QUERY_MODEL_OIDC_SCOPE;
export type InvokeModelOidcScope = typeof INVOKE_MODEL_OIDC_SCOPE;

/**
 * Canonical CRUD + invoke scopes enforced on the `callModel` API.
 *
 * Each scope corresponds 1:1 to a {@link KnownOnCallFunctionType}; see
 * {@link CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE}.
 */
export const CALL_MODEL_OIDC_SCOPES = [CREATE_MODEL_OIDC_SCOPE, READ_MODEL_OIDC_SCOPE, UPDATE_MODEL_OIDC_SCOPE, DELETE_MODEL_OIDC_SCOPE, QUERY_MODEL_OIDC_SCOPE, INVOKE_MODEL_OIDC_SCOPE] as const;

/**
 * Union of the six canonical callModel scope strings (CRUDQ + invoke).
 */
export type CallModelOidcScope = CreateModelOidcScope | ReadModelOidcScope | UpdateModelOidcScope | DeleteModelOidcScope | QueryModelOidcScope | InvokeModelOidcScope;

/**
 * Maps each known call type to the scope an OIDC token must carry to invoke it.
 */
export const CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE: Readonly<Record<KnownOnCallFunctionType, CallModelOidcScope>> = {
  create: 'model.create',
  read: 'model.read',
  update: 'model.update',
  delete: 'model.delete',
  query: 'model.query',
  invoke: 'model.invoke'
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
 * Pre-built scope picker entries for the five callModel CRUD scopes. Apps can
 * spread these into their own `OidcScopeDetails[]` arrays to avoid redeclaring
 * the same labels and descriptions in every downstream app.
 */
export const CALL_MODEL_OIDC_SCOPE_DETAILS: readonly LabeledValueWithDescription<CallModelOidcScope>[] = [
  { label: 'Create models', value: 'model.create', description: 'Create new model records via the callModel API' },
  { label: 'Read models', value: 'model.read', description: 'Read model records via the callModel API' },
  { label: 'Update models', value: 'model.update', description: 'Update model records via the callModel API' },
  { label: 'Delete models', value: 'model.delete', description: 'Delete model records via the callModel API' },
  { label: 'Query models', value: 'model.query', description: 'Query model records via the callModel API' },
  { label: 'Invoke model operations', value: 'model.invoke', description: 'Invoke RPC-style operations on model records via the callModel API' }
];

// MARK: Standard OIDC Scopes
/**
 * Standard OpenID Connect `openid` scope. Required on every OIDC auth request
 * to flag it as an OIDC (vs. plain OAuth 2.0) flow.
 */
export const OPENID_OIDC_SCOPE = 'openid' as const;

/**
 * Standard OpenID Connect `profile` scope. Grants the basic profile claims
 * (`name`, `picture`, etc.) in the ID token.
 */
export const PROFILE_OIDC_SCOPE = 'profile' as const;

/**
 * Standard OpenID Connect `email` scope. Grants `email` and `email_verified`
 * claims in the ID token.
 */
export const EMAIL_OIDC_SCOPE = 'email' as const;

/**
 * Standard OpenID Connect `offline_access` scope.
 *
 * Requesting this scope tells the OIDC provider that the client wants a
 * `refresh_token` alongside the access token. Per the OIDC core spec the
 * authorization request must also include `prompt=consent` — the underlying
 * `oidc-provider` library silently strips `offline_access` from the granted
 * scopes when consent isn't explicitly requested. `@dereekb/dbx-cli`'s
 * `buildAuthorizationUrl` adds `prompt=consent` automatically when this scope
 * is present in the request.
 */
export const OFFLINE_ACCESS_OIDC_SCOPE = 'offline_access' as const;

export type OpenidOidcScope = typeof OPENID_OIDC_SCOPE;
export type ProfileOidcScope = typeof PROFILE_OIDC_SCOPE;
export type EmailOidcScope = typeof EMAIL_OIDC_SCOPE;
export type OfflineAccessOidcScope = typeof OFFLINE_ACCESS_OIDC_SCOPE;

/**
 * The four standard OpenID Connect scopes defined by the OIDC core spec
 * (`openid`, `profile`, `email`, `offline_access`). Downstream apps typically
 * union this with their own app-specific scopes (e.g., `demo`, `hellosubs`)
 * and the {@link CallModelOidcScope} CRUD set.
 */
export type StandardOidcScope = OpenidOidcScope | ProfileOidcScope | EmailOidcScope | OfflineAccessOidcScope;

/**
 * The four standard OIDC scope strings, in canonical picker order.
 */
export const STANDARD_OIDC_SCOPES = [OPENID_OIDC_SCOPE, PROFILE_OIDC_SCOPE, EMAIL_OIDC_SCOPE, OFFLINE_ACCESS_OIDC_SCOPE] as const;

export const OPENID_OIDC_SCOPE_DETAILS: LabeledValueWithDescription<OpenidOidcScope> = {
  label: 'OpenID',
  value: OPENID_OIDC_SCOPE,
  description: 'Authenticate your identity using OpenID Connect'
};

export const PROFILE_OIDC_SCOPE_DETAILS: LabeledValueWithDescription<ProfileOidcScope> = {
  label: 'Profile',
  value: PROFILE_OIDC_SCOPE,
  description: 'Access your basic profile information'
};

export const EMAIL_OIDC_SCOPE_DETAILS: LabeledValueWithDescription<EmailOidcScope> = {
  label: 'Email',
  value: EMAIL_OIDC_SCOPE,
  description: 'Access your email address'
};

export const OFFLINE_ACCESS_OIDC_SCOPE_DETAILS: LabeledValueWithDescription<OfflineAccessOidcScope> = {
  label: 'Offline access',
  value: OFFLINE_ACCESS_OIDC_SCOPE,
  description: 'Allow the app to refresh access tokens while you are not signed in'
};

/**
 * Pre-built scope picker entries for the four standard OIDC scopes, in canonical
 * picker order. Apps spread these into their `OidcScopeDetails[]` arrays so the
 * standard scopes render consistently across consent screens and admin pickers.
 */
export const STANDARD_OIDC_SCOPE_DETAILS: readonly LabeledValueWithDescription<StandardOidcScope>[] = [OPENID_OIDC_SCOPE_DETAILS, PROFILE_OIDC_SCOPE_DETAILS, EMAIL_OIDC_SCOPE_DETAILS, OFFLINE_ACCESS_OIDC_SCOPE_DETAILS];

// MARK: Service Token Scope
/**
 * Custom OIDC scope that requests a long-lived, non-rotating "service" token,
 * intended for non-interactive server/API consumption (e.g. feeding a refresh
 * token to a CLI via an environment variable).
 *
 * This scope is privileged: provider-side wiring is expected to hard-reject the
 * request for non-admin users (via {@link OidcProviderConfig.adminOnlyScopes})
 * and to disable refresh-token rotation for grants carrying it (via
 * {@link OidcProviderConfig.nonRotatingScopes}). The generic
 * `@dereekb/firebase-server/oidc` package stays app-agnostic — the scope is only
 * activated when an app lists it in those config arrays and supplies an
 * `isAdminUser` delegate predicate.
 */
export const SERVICE_TOKEN_OIDC_SCOPE = 'token.service' as const;

export type ServiceTokenOidcScope = typeof SERVICE_TOKEN_OIDC_SCOPE;

/**
 * Pre-built scope picker entry for {@link SERVICE_TOKEN_OIDC_SCOPE}. Labeled as an
 * admin-only scope so consent screens and admin pickers signal that it is
 * restricted to privileged users.
 */
export const SERVICE_TOKEN_OIDC_SCOPE_DETAILS: LabeledValueWithDescription<ServiceTokenOidcScope> = {
  label: 'Service token (admin)',
  value: SERVICE_TOKEN_OIDC_SCOPE,
  description: 'Admin-only: issue a long-lived, non-rotating token for server/API use'
};
