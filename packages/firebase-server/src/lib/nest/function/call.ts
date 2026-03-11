import { type Configurable, type PromiseOrValue } from '@dereekb/util';
import { type CallableRequest } from 'firebase-functions/v2/https';
import { type NestApplicationContextRequest, type NestContextCallableRequest, type NestContextCallableRequestWithAuth } from './nest';
import { assertIsContextWithAuthData } from '../../function/context';
import { type MakeNestContext } from '../nest.provider';

// MARK: Application
/**
 * Request type for callable functions that receive an {@link INestApplicationContext} alongside the Firebase callable request data.
 *
 * @typeParam I - The expected input data type for the callable request.
 */
export type OnCallWithNestApplicationRequest<I> = NestApplicationContextRequest<CallableRequest<I>>;

/**
 * Runnable function that is passed an INestApplicationContext in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestApplication<I = unknown, O = unknown> = (request: OnCallWithNestApplicationRequest<I>) => PromiseOrValue<O>;

// MARK: Context
/**
 * Request type for callable functions that receive a typed nest context object alongside the Firebase callable request data.
 *
 * @typeParam N - The nest context type, typically an application-specific context class.
 * @typeParam I - The expected input data type for the callable request.
 */
export type OnCallWithNestContextRequest<N, I> = NestContextCallableRequest<N, I>;

/**
 * Runnable function that is passed an arbitrary nest context object in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestContext<N, I = unknown, O = unknown> = (request: OnCallWithNestContextRequest<N, I>) => PromiseOrValue<O>;

/**
 * Mutates the application-level request to attach a typed nest context, converting it to an {@link OnCallWithNestContextRequest}.
 *
 * This bridges the gap between the raw NestJS application context and the domain-specific context object
 * used by callable function handlers.
 *
 * @param makeNestContext - Factory that creates the typed context from the application context.
 * @param request - The application-level callable request to augment.
 * @returns The same request object, now typed with the nest context attached.
 */
export function setNestContextOnRequest<N, I>(makeNestContext: MakeNestContext<N>, request: OnCallWithNestApplicationRequest<I>): OnCallWithNestContextRequest<N, I> {
  (request as unknown as Configurable<OnCallWithNestContextRequest<N, I>>).nest = makeNestContext(request.nestApplication);
  return request as unknown as OnCallWithNestContextRequest<N, I>;
}

// MARK: Context With Auth
/**
 * Callable function handler that requires authenticated requests. The request's auth data is guaranteed to be present.
 *
 * Use {@link inAuthContext} to wrap this handler with runtime auth assertion, or use {@link assertRequestRequiresAuthForFunction}
 * to check auth requirements dynamically.
 *
 * @typeParam N - The nest context type.
 * @typeParam I - The expected input data type.
 * @typeParam O - The return type.
 */
export type OnCallWithAuthorizedNestContext<N, I = unknown, O = unknown> = ((request: NestContextCallableRequestWithAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Callable function handler that explicitly does not require authentication.
 *
 * Created via {@link optionalAuthContext} to flag a handler as accepting unauthenticated requests.
 *
 * @typeParam N - The nest context type.
 * @typeParam I - The expected input data type.
 * @typeParam O - The return type.
 */
export type OnCallWithOptionalAuthorizedNestContext<N, I = unknown, O = unknown> = OnCallWithNestContext<N, I, O> & {
  readonly _requireAuth: false;
};

/**
 * Wraps the input {@link OnCallWithNestContext} function to flag it as not requiring authentication.
 *
 * By default, callable functions with auth-aware nest context require auth. Use this wrapper to
 * explicitly opt out of that requirement for endpoints that should be publicly accessible.
 *
 * @example
 * ```ts
 * const handler = optionalAuthContext<MyContext, Input, Output>((request) => {
 *   // request.auth may be undefined
 *   return doSomething(request);
 * });
 * ```
 *
 * @param fn - The callable function handler to wrap.
 * @returns A new handler flagged with `_requireAuth: false`.
 */
export function optionalAuthContext<N, I, O>(fn: OnCallWithNestContext<N, I, O>): OnCallWithOptionalAuthorizedNestContext<N, I, O> {
  const fnWithOptionalAuth = ((request: OnCallWithNestContextRequest<N, I>) => fn(request)) as OnCallWithOptionalAuthorizedNestContext<N, I, O>;
  (fnWithOptionalAuth as Configurable<OnCallWithOptionalAuthorizedNestContext<N, I, O>>)._requireAuth = false;
  return fnWithOptionalAuth;
}

/**
 * Union type representing a callable function handler that may or may not require authentication,
 * determined at runtime by the {@link OnCallWithAuthAwareNestRequireAuthRef._requireAuth} flag.
 */
export type OnCallWithAuthAwareNestContext<N, I = unknown, O = unknown> = (OnCallWithAuthorizedNestContext<N, I, O> | OnCallWithOptionalAuthorizedNestContext<N, I, O>) & OnCallWithAuthAwareNestRequireAuthRef;

/**
 * Ref interface used to determine whether a callable function handler requires authentication at runtime.
 */
export interface OnCallWithAuthAwareNestRequireAuthRef {
  /**
   * If false, auth is not required.
   *
   * If true or not defined, then auth is required.
   */
  readonly _requireAuth?: boolean;
}

/**
 * Asserts that the input request has auth data if the inputOnCallWithAuthAwareNestRequireAuthRef object is flagged to require auth.
 *
 * @param fn
 * @param request
 */
export function assertRequestRequiresAuthForFunction(fn: OnCallWithAuthAwareNestRequireAuthRef, request: OnCallWithNestContextRequest<any, any>) {
  if (fn._requireAuth !== false) {
    assertIsContextWithAuthData(request);
  }
}

/**
 * Wraps an {@link OnCallWithAuthorizedNestContext} handler to enforce authentication at runtime.
 *
 * The wrapper calls {@link assertIsContextWithAuthData} before invoking the handler, ensuring that
 * unauthenticated requests are rejected with an appropriate error before reaching handler logic.
 *
 * @example
 * ```ts
 * const secureHandler = inAuthContext<MyContext, Input, Output>((request) => {
 *   // request.auth is guaranteed to be defined here
 *   return processAuthenticatedRequest(request);
 * });
 * ```
 *
 * @param fn - The authorized handler to wrap with auth assertion.
 * @returns A general {@link OnCallWithNestContext} handler that asserts auth before delegating.
 */
export function inAuthContext<N, I, O>(fn: OnCallWithAuthorizedNestContext<N, I, O>): OnCallWithNestContext<N, I, O> {
  return (request) => {
    assertIsContextWithAuthData(request);
    return fn(request);
  };
}
