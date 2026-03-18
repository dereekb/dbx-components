import { type ModelFirebaseCrudFunctionSpecifier, type ModelFirebaseCrudFunctionSpecifierRef, MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT } from '@dereekb/firebase';
import { type Configurable, type Maybe, objectToMap, type PromiseOrValue, serverError } from '@dereekb/util';
import { type NestContextCallableRequestWithOptionalAuth, type NestContextCallableRequestWithAuth } from '../function/nest';
import { badRequestError } from '../../function/error';
import { assertRequestRequiresAuthForFunction, type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type OnCallApiDetailsRef, aggregateSpecifierApiDetails } from './api.details';

/**
 * Request type for specifier-dispatched handlers that require authentication.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type.
 */
export type OnCallSpecifierHandlerNestContextRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A specifier handler function that requires an authenticated caller.
 */
export type OnCallSpecifierHandlerFunctionWithAuth<N, I = unknown, O = unknown> = ((request: OnCallSpecifierHandlerNestContextRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Request type for specifier-dispatched handlers that allow unauthenticated callers.
 */
export type OnCallSpecifierHandlerNestContextRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A specifier handler function that does not require authentication.
 */
export type OnCallSpecifierHandlerFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ((request: OnCallSpecifierHandlerNestContextRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

/**
 * Union of auth-required and optional-auth specifier handler functions.
 *
 * Each specifier handler within an {@link OnCallSpecifierHandlerConfig} may independently
 * declare its own auth requirements.
 */
export type OnCallSpecifierHandlerFunction<N, I = unknown, O = void> = (OnCallSpecifierHandlerFunctionWithAuth<N, I, O> | OnCallSpecifierHandlerFunctionWithOptionalAuth<N, I, O>) & OnCallWithAuthAwareNestRequireAuthRef;

// TODO(FUTURE): Add typing magic to ensure all expected function keys are present here.

/**
 * Configuration object mapping specifier keys to handler functions.
 *
 * The special key `_` is the default handler invoked when no specifier (or the default
 * specifier) is provided. Other keys correspond to named sub-operations on the same
 * model type, allowing a single CRUD slot to support multiple behaviors.
 *
 * @typeParam N - The NestJS context type.
 */
export type OnCallSpecifierHandlerConfig<N> = {
  /**
   * The default handler function, invoked when the specifier is `_` or omitted.
   */
  readonly _?: Maybe<OnCallSpecifierHandlerFunction<N, any, any>>;
  readonly [key: string]: Maybe<OnCallSpecifierHandlerFunction<N, any, any>>;
};

/**
 * Factory that creates a handler dispatching to sub-operations based on a specifier string.
 *
 * Use this when a single model type + CRUD operation needs to support multiple behaviors
 * (e.g., a profile update that can either update the default fields or change a username).
 * The resulting function is marked `_requireAuth = false` because auth enforcement is
 * delegated to each individual specifier handler.
 *
 * API details from all specifier handlers are aggregated into
 * {@link OnCallModelTypeApiDetails} for MCP introspection.
 *
 * @param config - Maps specifier keys to their handler functions.
 * @returns A callable function that dispatches by specifier, with aggregated API details.
 *
 * @example
 * ```typescript
 * const updateProfile = onCallSpecifierHandler<DemoNestContext>({
 *   _: updateProfileDefault,
 *   username: updateProfileUsername,
 *   fromUpload: updateProfileFromUpload
 * });
 * ```
 */
export function onCallSpecifierHandler<N, I = any, O = any>(config: OnCallSpecifierHandlerConfig<N>): OnCallWithNestContext<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef & OnCallApiDetailsRef {
  const map = objectToMap(config);

  const fn = (request: OnCallSpecifierHandlerNestContextRequestWithOptionalAuth<N, I>) => {
    const { specifier = MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT } = request;
    const handler = map.get(specifier);

    if (handler != null) {
      assertRequestRequiresAuthForFunction(handler, request);
      return handler(request as any) as PromiseOrValue<O>;
    } else {
      throw unknownModelCrudFunctionSpecifierError(specifier);
    }
  };

  (fn as Configurable<OnCallWithAuthAwareNestRequireAuthRef>)._requireAuth = false;

  // Aggregate _apiDetails from handler functions in the config
  const specifierApiDetails = aggregateSpecifierApiDetails(config as { readonly [key: string]: Maybe<OnCallApiDetailsRef> });

  if (specifierApiDetails != null) {
    (fn as Configurable<OnCallApiDetailsRef>)._apiDetails = specifierApiDetails;
  }

  return fn;
}

/**
 * Creates a bad-request error indicating the provided specifier is not recognized
 * by the current model CRUD handler.
 */
export function unknownModelCrudFunctionSpecifierError(specifier: ModelFirebaseCrudFunctionSpecifier) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_SPECIFIER_ERROR',
      message: 'Invalid/unknown specifier for this function.',
      data: {
        specifier
      }
    })
  );
}
