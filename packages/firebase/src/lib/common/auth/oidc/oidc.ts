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

export type CreateModelOidcScope = typeof CREATE_MODEL_OIDC_SCOPE;
export type ReadModelOidcScope = typeof READ_MODEL_OIDC_SCOPE;
export type UpdateModelOidcScope = typeof UPDATE_MODEL_OIDC_SCOPE;
export type DeleteModelOidcScope = typeof DELETE_MODEL_OIDC_SCOPE;
export type QueryModelOidcScope = typeof QUERY_MODEL_OIDC_SCOPE;

/**
 * Canonical CRUD scopes enforced on the `callModel` API.
 *
 * Each scope corresponds 1:1 to a {@link KnownOnCallFunctionType}; see
 * {@link CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE}.
 */
export const CALL_MODEL_OIDC_SCOPES = [CREATE_MODEL_OIDC_SCOPE, READ_MODEL_OIDC_SCOPE, UPDATE_MODEL_OIDC_SCOPE, DELETE_MODEL_OIDC_SCOPE, QUERY_MODEL_OIDC_SCOPE] as const;

/**
 * Union of the five canonical callModel CRUD scope strings.
 */
export type CallModelOidcScope = CreateModelOidcScope | ReadModelOidcScope | UpdateModelOidcScope | DeleteModelOidcScope | QueryModelOidcScope;

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
 * Pre-built scope picker entries for the five callModel CRUD scopes. Apps can
 * spread these into their own `OidcScopeDetails[]` arrays to avoid redeclaring
 * the same labels and descriptions in every downstream app.
 */
export const CALL_MODEL_OIDC_SCOPE_DETAILS: readonly LabeledValueWithDescription<CallModelOidcScope>[] = [
  { label: 'Create models', value: 'model.create', description: 'Create new model records via the callModel API' },
  { label: 'Read models', value: 'model.read', description: 'Read model records via the callModel API' },
  { label: 'Update models', value: 'model.update', description: 'Update model records via the callModel API' },
  { label: 'Delete models', value: 'model.delete', description: 'Delete model records via the callModel API' },
  { label: 'Query models', value: 'model.query', description: 'Query model records via the callModel API' }
];
