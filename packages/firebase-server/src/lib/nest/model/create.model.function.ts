import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallCreateModelParams, type OnCallCreateModelResult, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequestWithOptionalAuth, type NestContextCallableRequestWithAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
/**
 * Request type for model create handlers that require authentication.
 *
 * Combines the authenticated NestJS context with the optional CRUD function specifier,
 * allowing handlers to access both auth data and identify sub-operations.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type for the create operation.
 */
export type OnCallCreateModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
/**
 * A model create handler function that requires an authenticated caller.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type for the create operation.
 * @typeParam O - The output type returned on success.
 */
export type OnCallCreateModelFunctionWithAuth<N, I = unknown, O = unknown> = ((request: OnCallCreateModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Request type for model create handlers that allow unauthenticated callers.
 */
export type OnCallCreateModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model create handler function that does not require authentication.
 *
 * Useful for public-facing creation endpoints such as anonymous sign-up flows.
 */
export type OnCallCreateModelFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ((request: OnCallCreateModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

/**
 * Standard model create handler requiring auth (the common case).
 */
export type OnCallCreateModelFunction<N, I = unknown, O extends OnCallCreateModelResult = OnCallCreateModelResult> = OnCallCreateModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;

/**
 * Union of auth-required and optional-auth create handlers.
 *
 * Used in {@link OnCallCreateModelMap} so both variants can be registered side by side.
 */
export type OnCallCreateModelFunctionAuthAware<N, I = unknown, O extends OnCallCreateModelResult = OnCallCreateModelResult> = OnCallCreateModelFunction<N, I, O> | OnCallCreateModelFunctionWithOptionalAuth<N, I, O>;

/**
 * Maps Firestore model type strings to their create handler functions.
 *
 * Pass this map to {@link onCallCreateModel} to register all model types
 * that support creation through the call model system.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam T - The Firestore model identity constraining valid model type keys.
 */
export type OnCallCreateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallCreateModelFunctionAuthAware<N, any, OnCallCreateModelResult>;
};

/**
 * Configuration for {@link onCallCreateModel}.
 */
export interface OnCallCreateModelConfig<N> {
  /** Optional assertion run before the create handler; throw to reject. */
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallCreateModelParams>;
}

/**
 * Factory that creates a callable function handling model creation for multiple model types.
 *
 * Dispatches to the correct handler based on the `modelType` field in the request,
 * enforces auth requirements per handler, and aggregates API details for MCP introspection.
 *
 * @param map - Maps model type strings to their create handler functions.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function for the 'create' CRUD operation.
 *
 * @example
 * ```typescript
 * const createHandler = onCallCreateModel<DemoNestContext>({
 *   profile: createProfile,
 *   guestbook: createGuestbook
 * });
 * ```
 */
export function onCallCreateModel<N>(map: OnCallCreateModelMap<N>, config: OnCallCreateModelConfig<N> = {}): OnCallWithNestContext<N, OnCallCreateModelParams, OnCallCreateModelResult> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'create',
    crudType: 'create',
    preAssert,
    throwOnUnknownModelType: createModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallCreateModelParams, OnCallCreateModelResult>;
}

/**
 * Creates a bad-request error indicating the requested model type is not valid for creation.
 */
export function createModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: `Invalid type "${modelType}" to create.`,
      data: {
        modelType
      }
    })
  );
}
