import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallUpdateModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth, type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
/**
 * Request type for model update handlers that require authentication.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type for the update operation.
 */
export type OnCallUpdateModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model update handler function that requires an authenticated caller.
 */
export type OnCallUpdateModelFunctionWithAuth<N, I = unknown, O = void> = ((request: OnCallUpdateModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Request type for model update handlers that allow unauthenticated callers.
 */
export type OnCallUpdateModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model update handler function that does not require authentication.
 */
export type OnCallUpdateModelFunctionWithOptionalAuth<N, I = unknown, O = void> = ((request: OnCallUpdateModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

/**
 * Standard model update handler requiring auth (the common case).
 */
export type OnCallUpdateModelFunction<N, I = unknown, O = void> = OnCallUpdateModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;

/**
 * Union of auth-required and optional-auth update handlers.
 */
export type OnCallUpdateModelFunctionAuthAware<N, I = unknown, O = void> = OnCallUpdateModelFunction<N, I, O> | OnCallUpdateModelFunctionWithOptionalAuth<N, I, O>;

/**
 * Maps Firestore model type strings to their update handler functions.
 *
 * Pass this map to {@link onCallUpdateModel} to register all model types
 * that support updates through the call model system.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam T - The Firestore model identity constraining valid model type keys.
 */
export type OnCallUpdateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallUpdateModelFunctionAuthAware<N, any, any>;
};

/**
 * Configuration for {@link onCallUpdateModel}.
 */
export interface OnCallUpdateModelConfig<N> {
  /** Optional assertion run before the update handler; throw to reject. */
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallUpdateModelParams>;
}

/**
 * Factory that creates a callable function handling model updates for multiple model types.
 *
 * Dispatches to the correct handler based on the `modelType` field in the request,
 * enforces auth requirements per handler, and aggregates API details for MCP introspection.
 *
 * @param map - Maps model type strings to their update handler functions.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function for the 'update' CRUD operation.
 *
 * @example
 * ```typescript
 * const updateHandler = onCallUpdateModel<DemoNestContext>({
 *   profile: onCallSpecifierHandler({
 *     _: updateProfileDefault,
 *     username: updateProfileUsername
 *   }),
 *   guestbook: updateGuestbook
 * });
 * ```
 */
export function onCallUpdateModel<N>(map: OnCallUpdateModelMap<N>, config: OnCallUpdateModelConfig<N> = {}): OnCallWithNestContext<N, OnCallUpdateModelParams, unknown> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'update',
    crudType: 'update',
    preAssert,
    throwOnUnknownModelType: updateModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallUpdateModelParams, unknown>;
}

/**
 * Creates a bad-request error indicating the requested model type is not valid for updating.
 */
export function updateModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: 'Invalid type to update.',
      data: {
        modelType
      }
    })
  );
}
