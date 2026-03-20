import { type Configurable, type PromiseOrValue, serverError, type Maybe } from '@dereekb/util';
import { type FirestoreModelIdentity, type FirestoreModelType, type FirestoreModelTypes, type ModelFirebaseCrudFunctionSpecifierRef, type OnCallFunctionType, type OnCallTypedModelParams } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { assertRequestRequiresAuthForFunction, type OnCallWithAuthAwareNestContext, type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext, type OnCallWithNestContextRequest } from '../function/call';
import { type AssertModelCrudRequestFunctionContextCrudType, type AssertModelCrudRequestFunction } from './crud.assert.function';
import { type NestContextCallableRequest } from '../function/nest';
import { type OnCallApiDetailsRef, type OnCallModelApiDetails, aggregateCrudModelApiDetails, aggregateModelApiDetails, resolveAnalyticsFromApiDetails } from './api.details';
import { type OnCallAnalyticsContext } from './analytics.details';
import { type OnCallModelAnalyticsService, ON_CALL_MODEL_ANALYTICS_SERVICE } from './analytics.handler';
import { callWithAnalytics } from './analytics.emit';

// MARK: Function
/**
 * Maps CRUD call type strings (e.g., 'create', 'read', 'update', 'delete') to their
 * corresponding handler functions.
 *
 * Used by {@link onCallModel} to dispatch incoming requests to the correct CRUD handler.
 */
export type OnCallModelMap = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly [call: OnCallFunctionType]: OnCallWithNestContext<any, OnCallTypedModelParams>;
};

/**
 * Configuration for {@link onCallModel}.
 *
 * Allows injecting a pre-assertion hook that runs before any CRUD handler is invoked,
 * useful for cross-cutting concerns like rate limiting or feature flags.
 */
export interface OnCallModelConfig {
  /**
   * Optional assertion function invoked before dispatching to the CRUD handler.
   * Throw to reject the request.
   */
  readonly preAssert?: AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams>;
  /**
   * Override the analytics handler injection token.
   * Default: {@link ON_CALL_MODEL_ANALYTICS_SERVICE}
   */
  readonly analyticsToken?: string;
}

/**
 * Top-level factory that creates a single callable function dispatching to CRUD operations.
 *
 * Incoming requests carry a `call` field (e.g., 'create', 'read') that selects the
 * appropriate handler from the provided map. API details from all handlers are aggregated
 * for MCP tool generation.
 *
 * @param map - Maps call type strings to their CRUD handler functions.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function that dispatches to the correct CRUD handler, with aggregated {@link OnCallApiDetailsRef._apiDetails}.
 *
 * @example
 * ```typescript
 * const callModel = onCallModel({
 *   create: onCallCreateModel({ profile: createProfile, guestbook: createGuestbook }),
 *   read: onCallReadModel({ profile: readProfile }),
 *   update: onCallUpdateModel({ profile: updateProfile }),
 *   delete: onCallDeleteModel({ guestbook: deleteGuestbook })
 * });
 * ```
 */
export function onCallModel(map: OnCallModelMap, config: OnCallModelConfig = {}): OnCallWithNestContext<unknown, OnCallTypedModelParams> & OnCallApiDetailsRef {
  const { preAssert = () => undefined, analyticsToken } = config;
  const resolvedToken = analyticsToken ?? ON_CALL_MODEL_ANALYTICS_SERVICE;

  // Aggregate _apiDetails from CRUD handlers in the map (built once at setup, not per-request)
  const aggregatedApiDetails = aggregateModelApiDetails(map as { readonly [key: string]: OnCallApiDetailsRef | undefined });
  const modelApiDetails: OnCallModelApiDetails = (aggregatedApiDetails as OnCallModelApiDetails | undefined) ?? {};

  // Resolve analytics service from NestContext per-request.
  // Not cached because the NestJS application instance may differ across test suites
  // when the onCallModel closure is shared as a module-level singleton.
  function getAnalyticsService(request: OnCallWithNestContextRequest<unknown, OnCallTypedModelParams>): Maybe<OnCallModelAnalyticsService> {
    try {
      return request?.nestApplication?.get(resolvedToken, { strict: false });
    } catch {
      // silent — analytics is optional
      return undefined;
    }
  }

  const fn = (request: OnCallWithNestContextRequest<unknown, OnCallTypedModelParams>) => {
    const call = request.data.call;

    if (!call) {
      throw onCallModelMissingCallTypeError();
    }

    const callFn = map[call];

    if (!callFn) {
      throw onCallModelUnknownCallTypeError(call);
    }

    const { specifier, modelType } = request.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth = (request as any).auth;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: OnCallAnalyticsContext = { call, modelType, specifier, uid: auth?.uid, auth, data: request.data.data, request: request as any };

    preAssert(context);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: PromiseOrValue<any>;

    // Resolve analytics from _apiDetails tree — callWithAnalytics handles undefined details
    const analyticsService = getAnalyticsService(request);
    const analyticsDetails = resolveAnalyticsFromApiDetails(modelApiDetails, call, modelType, specifier);

    if (analyticsService && analyticsDetails) {
      result = callWithAnalytics({ service: analyticsService, details: analyticsDetails, context, execute: () => callFn(request) });
    } else {
      result = callFn(request);
    }

    return result;
  };

  if (aggregatedApiDetails != null) {
    (fn as Configurable<OnCallApiDetailsRef>)._apiDetails = aggregatedApiDetails;
  }

  return fn;
}

/**
 * Creates a bad-request error indicating the `call` field was missing from the request payload.
 *
 * @returns A bad-request error with CALL_TYPE_MISSING_ERROR code.
 */
export function onCallModelMissingCallTypeError() {
  return badRequestError(
    serverError({
      status: 400,
      code: 'CALL_TYPE_MISSING_ERROR',
      message: `The call type was missing from the request.`
    })
  );
}

/**
 * Creates a bad-request error indicating the provided `call` type is not recognized.
 *
 * @param call - The unrecognized call type string.
 * @returns A bad-request error with UNKNOWN_CALL_TYPE_ERROR code.
 */
export function onCallModelUnknownCallTypeError(call: OnCallFunctionType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_CALL_TYPE_ERROR',
      message: `Unknown call type "${call}".`,
      data: {
        call
      }
    })
  );
}

// MARK: OnCallWithCallType
/**
 * Maps Firestore model type strings to their handler functions for a single CRUD operation.
 *
 * Each handler receives the NestContext request and an optional specifier, and may
 * declare whether it requires authentication via {@link OnCallWithAuthAwareNestRequireAuthRef}.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam T - The Firestore model identity constraining which model type keys are valid.
 */
export type OnCallWithCallTypeModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly [K in FirestoreModelTypes<T>]?: ((request: NestContextCallableRequest<N, any> & ModelFirebaseCrudFunctionSpecifierRef) => PromiseOrValue<any>) & OnCallWithAuthAwareNestRequireAuthRef;
};

/**
 * Internal configuration for {@link _onCallWithCallTypeFunction}.
 *
 * Shared by the CRUD-specific factories (create, read, update, delete) to avoid
 * duplicating dispatch and assertion logic.
 *
 * @typeParam N - The NestJS context type.
 */
export interface OnCallWithCallTypeModelConfig<N> {
  /**
   * The call type string (e.g., 'create', 'read') passed through to assertions.
   */
  readonly callType: string;
  /**
   * The CRUD category used by {@link AssertModelCrudRequestFunction}.
   */
  readonly crudType: AssertModelCrudRequestFunctionContextCrudType;
  /**
   * Optional assertion run before the model handler; throw to reject.
   */
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallTypedModelParams>;
  /**
   * Error factory invoked when the requested model type has no handler in the map.
   */
  readonly throwOnUnknownModelType: (modelType: FirestoreModelType) => Error;
}

/**
 * Internal factory used by the CRUD-specific wrappers ({@link onCallCreateModel}, {@link onCallReadModel}, etc.).
 *
 * Dispatches to the correct model-type handler from the map, enforces auth requirements,
 * runs pre-assertions, and aggregates API details from all handlers for MCP introspection.
 *
 * @param map - Maps model type strings to their handler functions.
 * @param config - Configuration including call type, crud type, and error factory.
 * @returns A callable function that dispatches to the correct model-type handler.
 * @internal Not intended for direct use outside the model CRUD module.
 */
export function _onCallWithCallTypeFunction<N>(map: OnCallWithCallTypeModelMap<N>, config: OnCallWithCallTypeModelConfig<N>): OnCallWithAuthAwareNestContext<N, OnCallTypedModelParams, unknown> & OnCallApiDetailsRef {
  const { callType, preAssert = () => undefined, throwOnUnknownModelType } = config;

  const fn = (request: OnCallWithNestContextRequest<N, OnCallTypedModelParams>) => {
    const modelType = request.data.modelType;
    const crudFn = map[modelType];

    if (crudFn) {
      const specifier = request.data.specifier;
      assertRequestRequiresAuthForFunction(crudFn, request);
      preAssert({ call: callType, request, modelType, specifier });

      return crudFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw throwOnUnknownModelType(modelType);
    }
  };

  // Aggregate _apiDetails from model type handlers in the map
  const crudModelApiDetails = aggregateCrudModelApiDetails(map as { readonly [key: string]: OnCallApiDetailsRef | undefined });

  if (crudModelApiDetails != null) {
    (fn as Configurable<OnCallApiDetailsRef>)._apiDetails = crudModelApiDetails;
  }

  return fn;
}
