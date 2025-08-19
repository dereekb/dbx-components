import { type Configurable, type PromiseOrValue } from '@dereekb/util';
import { type CallableRequest } from 'firebase-functions/lib/common/providers/https';
import { type NestApplicationContextRequest, type NestContextCallableRequest, type NestContextCallableRequestWithAuth } from './nest';
import { assertIsContextWithAuthData } from '../../function/context';
import { type MakeNestContext } from '../nest.provider';

// MARK: Application
export type OnCallWithNestApplicationRequest<I> = NestApplicationContextRequest<CallableRequest<I>>;

/**
 * Runnable function that is passed an INestApplicationContext in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestApplication<I = unknown, O = unknown> = (request: OnCallWithNestApplicationRequest<I>) => PromiseOrValue<O>;

// MARK: Context
export type OnCallWithNestContextRequest<N, I> = NestContextCallableRequest<N, I>;

/**
 * Runnable function that is passed an arbitrary nest context object in addition to the usual data/context provided by firebase.
 */
export type OnCallWithNestContext<N, I = unknown, O = unknown> = (request: OnCallWithNestContextRequest<N, I>) => PromiseOrValue<O>;

export function setNestContextOnRequest<N, I>(makeNestContext: MakeNestContext<N>, request: OnCallWithNestApplicationRequest<I>): OnCallWithNestContextRequest<N, I> {
  (request as unknown as Configurable<OnCallWithNestContextRequest<N, I>>).nest = makeNestContext(request.nestApplication);
  return request as unknown as OnCallWithNestContextRequest<N, I>;
}

// MARK: Context With Auth
export type OnCallWithAuthorizedNestContext<N, I = unknown, O = unknown> = ((request: NestContextCallableRequestWithAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

export type OnCallWithOptionalAuthorizedNestContext<N, I = unknown, O = unknown> = OnCallWithNestContext<N, I, O> & {
  readonly _requireAuth: false;
};

/**
 * Wraps the input OnCallWithNestContext function to flag it as optional to have auth data.
 *
 * @param fn
 * @returns
 */
export function optionalAuthContext<N, I, O>(fn: OnCallWithNestContext<N, I, O>): OnCallWithOptionalAuthorizedNestContext<N, I, O> {
  const fnWithOptionalAuth = ((request: OnCallWithNestContextRequest<N, I>) => fn(request)) as OnCallWithOptionalAuthorizedNestContext<N, I, O>;
  (fnWithOptionalAuth as Configurable<OnCallWithOptionalAuthorizedNestContext<N, I, O>>)._requireAuth = false;
  return fnWithOptionalAuth;
}

export type OnCallWithAuthAwareNestContext<N, I = unknown, O = unknown> = (OnCallWithAuthorizedNestContext<N, I, O> | OnCallWithOptionalAuthorizedNestContext<N, I, O>) & OnCallWithAuthAwareNestRequireAuthRef;

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
 * Creates an OnCallWithNestContext wrapper that validates the input CallableContext to assert the context has auth data before entering the function.
 *
 * @param fn
 * @returns
 */
export function inAuthContext<N, I, O>(fn: OnCallWithAuthorizedNestContext<N, I, O>): OnCallWithNestContext<N, I, O> {
  return (request) => {
    assertIsContextWithAuthData(request);
    return fn(request);
  };
}
