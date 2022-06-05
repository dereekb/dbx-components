import { INestApplicationContext } from '@nestjs/common';
import { CallableRequest } from 'firebase-functions/lib/common/providers/https';
import { CallableContextWithAuthData } from '../../function/context';

export type NestApplicationContextRequest<R> = R & {
  readonly nestApplication: INestApplicationContext;
};

export type NestRef<N> = {
  readonly nest: N;
};

export type NestContextRequest<N, R> = R & {
  readonly nest: N;
};

export function injectNestIntoRequest<N, R>(nest: N, request: R): NestContextRequest<N, R> {
  return {
    ...request,
    nest
  };
}

export function injectNestApplicationContextIntoRequest<R>(nestContext: INestApplicationContext, request: R): NestApplicationContextRequest<R> {
  return {
    ...request,
    nestApplication: nestContext
  };
}

// MARK: Types
export type NestContextCallableRequest<N, I> = NestContextRequest<N, CallableRequest<I>>;

/**
 * NestContextCallableRequest that has valid auth attached to it.
 */
export type NestContextCallableRequestWithAuth<N, I> = CallableContextWithAuthData<NestContextCallableRequest<N, I>>;
