import { type INestApplicationContext } from '@nestjs/common';
import { type CallableRequest } from 'firebase-functions/v2/https';
import { type CallableContextWithAuthData } from '../../function/context';
import { type OnCallWithNestContextRequest } from './call';

/**
 * Augments a request type with a reference to the raw {@link INestApplicationContext}.
 *
 * This is the lowest-level nest integration type -- most handlers should prefer {@link NestContextRequest}
 * which provides a typed, domain-specific context instead of the raw application context.
 *
 * @typeParam R - The base request type to augment.
 */
export type NestApplicationContextRequest<R> = R & {
  readonly nestApplication: INestApplicationContext;
};

/**
 * Simple reference wrapper holding a typed nest context object.
 *
 * @typeParam N - The nest context type.
 */
export type NestRef<N> = {
  readonly nest: N;
};

/**
 * Augments a request type with a typed nest context and the raw {@link INestApplicationContext}.
 *
 * This is the primary request shape used by nest-integrated Firebase function handlers throughout the codebase.
 * It extends {@link NestApplicationContextRequest} so that handlers always have access to both the
 * typed domain context and the underlying NestJS application context.
 *
 * @typeParam N - The nest context type, typically an application-specific context class.
 * @typeParam R - The base request type to augment.
 */
export type NestContextRequest<N, R> = NestApplicationContextRequest<R> & {
  readonly nest: N;
};

/**
 * Creates a new request object with the typed nest context spread into it.
 *
 * Unlike {@link injectNestApplicationContextIntoRequest}, this attaches a domain-specific context rather
 * than the raw NestJS application context. The input request must already be a {@link NestApplicationContextRequest}
 * so that the resulting {@link NestContextRequest} retains access to the raw application context.
 *
 * @param nest - The typed nest context to attach.
 * @param request - The base request to augment (must include the nestApplication reference).
 * @returns A new object combining the request properties with the nest context.
 */
export function injectNestIntoRequest<N, R>(nest: N, request: NestApplicationContextRequest<R>): NestContextRequest<N, R> {
  return {
    ...(request as NestApplicationContextRequest<R> & R),
    nest
  } as NestContextRequest<N, R>;
}

/**
 * Creates a new request object with the raw {@link INestApplicationContext} spread into it.
 *
 * This is typically used at the outermost layer of function wiring before a {@link MakeNestContext}
 * factory converts it into a typed context via {@link injectNestIntoRequest}.
 *
 * @param nestContext - The NestJS application context to attach.
 * @param request - The base request to augment.
 * @returns A new object combining the request properties with the application context.
 */
export function injectNestApplicationContextIntoRequest<R>(nestContext: INestApplicationContext, request: R): NestApplicationContextRequest<R> {
  return {
    ...request,
    nestApplication: nestContext
  };
}

// MARK: Types
/**
 * A Firebase v2 {@link CallableRequest} augmented with a typed nest context.
 *
 * @typeParam N - The nest context type.
 * @typeParam I - The callable request input data type.
 */
export type NestContextCallableRequest<N, I> = NestContextRequest<N, CallableRequest<I>>;

/**
 * Equivalent to OnCallWithNestContextRequest
 */
export type NestContextCallableRequestWithOptionalAuth<N, I> = OnCallWithNestContextRequest<N, I>;

/**
 * NestContextCallableRequest that has valid auth attached to it.
 */
export type NestContextCallableRequestWithAuth<N, I> = CallableContextWithAuthData<NestContextCallableRequest<N, I>>;
