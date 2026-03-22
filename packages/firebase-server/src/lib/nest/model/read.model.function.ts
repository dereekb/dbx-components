import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallReadModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth, type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
/**
 * Request type for model read handlers that require authentication.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type for the read operation.
 */
export type OnCallReadModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model read handler function that requires an authenticated caller.
 */
export type OnCallReadModelFunctionWithAuth<N, I = unknown, O = unknown> = ((request: OnCallReadModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Request type for model read handlers that allow unauthenticated callers.
 */
export type OnCallReadModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model read handler function that does not require authentication.
 *
 * Useful for public-facing read endpoints such as listing public content.
 */
export type OnCallReadModelFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ((request: OnCallReadModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

/**
 * Standard model read handler requiring auth (the common case).
 */
export type OnCallReadModelFunction<N, I = unknown, O = unknown> = OnCallReadModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;

/**
 * Union of auth-required and optional-auth read handlers.
 */
export type OnCallReadModelFunctionAuthAware<N, I = unknown, O = unknown> = OnCallReadModelFunction<N, I, O> | OnCallReadModelFunctionWithOptionalAuth<N, I, O>;

/**
 * Maps Firestore model type strings to their read handler functions.
 *
 * Pass this map to {@link onCallReadModel} to register all model types
 * that support reading through the call model system.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam T - The Firestore model identity constraining valid model type keys.
 */
export type OnCallReadModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallReadModelFunctionAuthAware<N, any, any>;
};

/**
 * Configuration for {@link onCallReadModel}.
 */
export interface OnCallReadModelConfig<N> {
  /**
   * Optional assertion run before the read handler; throw to reject.
   */
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallReadModelParams>;
}

/**
 * Factory that creates a callable function handling model reads for multiple model types.
 *
 * Dispatches to the correct handler based on the `modelType` field in the request,
 * enforces auth requirements per handler, and aggregates API details for MCP introspection.
 *
 * @param map - Maps model type strings to their read handler functions.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function for the 'read' CRUD operation.
 *
 * @example
 * ```typescript
 * const readHandler = onCallReadModel<DemoNestContext>({
 *   profile: readProfile,
 *   guestbook: readGuestbook
 * });
 * ```
 */
export function onCallReadModel<N>(map: OnCallReadModelMap<N>, config: OnCallReadModelConfig<N> = {}): OnCallWithNestContext<N, OnCallReadModelParams, unknown> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'read',
    crudType: 'read',
    preAssert,
    throwOnUnknownModelType: readModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallReadModelParams, unknown>;
}

/**
 * Creates a bad-request error indicating the requested model type is not valid for reading.
 *
 * @param modelType - The unrecognized model type string.
 * @returns A bad-request error with UNKNOWN_TYPE_ERROR code.
 */
export function readModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: 'Invalid type to read.',
      data: {
        modelType
      }
    })
  );
}
