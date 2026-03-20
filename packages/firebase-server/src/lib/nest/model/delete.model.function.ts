import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallDeleteModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type NestContextCallableRequestWithOptionalAuth, type NestContextCallableRequestWithAuth } from '../function/nest';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
/**
 * Request type for model delete handlers that require authentication.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type for the delete operation.
 */
export type OnCallDeleteModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model delete handler function that requires an authenticated caller.
 */
export type OnCallDeleteModelFunctionWithAuth<N, I = unknown, O = void> = ((request: OnCallDeleteModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Request type for model delete handlers that allow unauthenticated callers.
 */
export type OnCallDeleteModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model delete handler function that does not require authentication.
 */
export type OnCallDeleteModelFunctionWithOptionalAuth<N, I = unknown, O = void> = ((request: OnCallDeleteModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

/**
 * Standard model delete handler requiring auth (the common case).
 */
export type OnCallDeleteModelFunction<N, I = unknown, O = void> = OnCallDeleteModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;

/**
 * Union of auth-required and optional-auth delete handlers.
 */
export type OnCallDeleteModelFunctionAuthAware<N, I = unknown, O = void> = OnCallDeleteModelFunction<N, I, O> | OnCallDeleteModelFunctionWithOptionalAuth<N, I, O>;

/**
 * Maps Firestore model type strings to their delete handler functions.
 *
 * Pass this map to {@link onCallDeleteModel} to register all model types
 * that support deletion through the call model system.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam T - The Firestore model identity constraining valid model type keys.
 */
export type OnCallDeleteModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly [K in FirestoreModelTypes<T>]?: OnCallDeleteModelFunctionAuthAware<N, any, any>;
};

/**
 * Configuration for {@link onCallDeleteModel}.
 */
export interface OnCallDeleteModelConfig<N> {
  /**
   * Optional assertion run before the delete handler; throw to reject.
   */
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallDeleteModelParams>;
}

/**
 * Factory that creates a callable function handling model deletion for multiple model types.
 *
 * Dispatches to the correct handler based on the `modelType` field in the request,
 * enforces auth requirements per handler, and aggregates API details for MCP introspection.
 *
 * @param map - Maps model type strings to their delete handler functions.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function for the 'delete' CRUD operation.
 *
 * @example
 * ```typescript
 * const deleteHandler = onCallDeleteModel<DemoNestContext>({
 *   guestbook: deleteGuestbook,
 *   guestbookEntry: deleteGuestbookEntry
 * });
 * ```
 */
export function onCallDeleteModel<N>(map: OnCallDeleteModelMap<N>, config: OnCallDeleteModelConfig<N> = {}): OnCallWithNestContext<N, OnCallDeleteModelParams, unknown> {
  const { preAssert } = config;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _onCallWithCallTypeFunction(map as any, {
    callType: 'delete',
    crudType: 'delete',
    preAssert,
    throwOnUnknownModelType: deleteModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallDeleteModelParams, unknown>;
}

/**
 * Creates a bad-request error indicating the requested model type is not valid for deletion.
 *
 * @param modelType - The unrecognized model type string.
 * @returns A bad-request error with UNKNOWN_TYPE_ERROR code.
 */
export function deleteModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: 'Invalid type to delete.',
      data: {
        modelType
      }
    })
  );
}
