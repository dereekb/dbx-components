import { type Configurable, type PromiseOrValue } from '@dereekb/util';
import { type CallableRequest } from 'firebase-functions/lib/common/providers/https';
import { type NestApplicationContextRequest, type NestContextCallableRequest, type NestContextCallableRequestWithAuth } from './nest';
import { isContextWithAuthData } from '../../function/context';
import { unauthenticatedContextHasNoUidError } from '../../function/error';
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
export type OnCallWithAuthorizedNestContext<N, I = unknown, O = unknown> = (request: NestContextCallableRequestWithAuth<N, I>) => PromiseOrValue<O>;

/**
 * Creates an OnCallWithNestContext wrapper that validates the input CallableContext to assert the context has auth data before entering the function.
 *
 * @param fn
 * @returns
 */
export function inAuthContext<N, I, O>(fn: OnCallWithAuthorizedNestContext<N, I, O>): OnCallWithNestContext<N, I, O> {
  return (request) => {
    if (isContextWithAuthData(request)) {
      return fn(request);
    } else {
      throw unauthenticatedContextHasNoUidError();
    }
  };
}
