import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallInvokeModelParams, type ModelFirebaseCrudFunctionSpecifierRef, UNKNOWN_MODEL_TYPE_ERROR_CODE } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth, type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
/**
 * Request type for model invoke handlers that require authentication.
 *
 * Invoke is the sixth call type (alongside CRUDQ) for side-effecting RPC-style operations
 * that don't map cleanly onto any CRUD verb — e.g. regenerate-thumbnails, resync-with-external,
 * recompute-index. Each handler is bound to a model type; permission checks use `useModel()`
 * exactly like an update handler.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type for the invoke operation.
 */
export type OnCallInvokeModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model invoke handler function that requires an authenticated caller.
 */
export type OnCallInvokeModelFunctionWithAuth<N, I = unknown, O = unknown> = ((request: OnCallInvokeModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Request type for model invoke handlers that allow unauthenticated callers.
 */
export type OnCallInvokeModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model invoke handler function that does not require authentication.
 */
export type OnCallInvokeModelFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ((request: OnCallInvokeModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

/**
 * Standard model invoke handler requiring auth (the common case).
 */
export type OnCallInvokeModelFunction<N, I = unknown, O = unknown> = OnCallInvokeModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;

/**
 * Union of auth-required and optional-auth invoke handlers.
 */
export type OnCallInvokeModelFunctionAuthAware<N, I = unknown, O = unknown> = OnCallInvokeModelFunction<N, I, O> | OnCallInvokeModelFunctionWithOptionalAuth<N, I, O>;

/**
 * Maps Firestore model type strings to their invoke handler functions.
 *
 * Pass this map to {@link onCallInvokeModel} to register all model types
 * that support invoke RPCs through the call model system.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam T - The Firestore model identity constraining valid model type keys.
 */
export type OnCallInvokeModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallInvokeModelFunctionAuthAware<N, any, any>;
};

/**
 * Configuration for {@link onCallInvokeModel}.
 */
export interface OnCallInvokeModelConfig<N> {
  /**
   * Optional assertion run before the invoke handler; throw to reject.
   */
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallInvokeModelParams>;
}

/**
 * Factory that creates a callable function handling model invokes for multiple model types.
 *
 * Dispatches to the correct handler based on the `modelType` field in the request,
 * enforces auth requirements per handler, and aggregates API details for MCP introspection.
 *
 * @param map - Maps model type strings to their invoke handler functions.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function for the 'invoke' call operation.
 *
 * @example
 * ```typescript
 * const invokeHandler = onCallInvokeModel<DemoNestContext>({
 *   guestbookEntry: onCallSpecifierHandler({
 *     recomputeLikes: guestbookEntryRecomputeLikes
 *   })
 * });
 * ```
 */
export function onCallInvokeModel<N>(map: OnCallInvokeModelMap<N>, config: OnCallInvokeModelConfig<N> = {}): OnCallWithNestContext<N, OnCallInvokeModelParams, unknown> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'invoke',
    crudType: 'invoke',
    preAssert,
    throwOnUnknownModelType: invokeModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallInvokeModelParams, unknown>;
}

/**
 * Creates a bad-request error indicating the requested model type is not valid for invoking.
 *
 * @param modelType - The unrecognized model type string.
 * @returns A bad-request error with {@link UNKNOWN_MODEL_TYPE_ERROR_CODE} code.
 */
export function invokeModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: UNKNOWN_MODEL_TYPE_ERROR_CODE,
      message: 'Invalid type to invoke.',
      data: {
        modelType
      }
    })
  );
}
