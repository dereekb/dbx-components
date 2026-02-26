import { type CallableContext } from '../type';
import { unauthenticatedContextHasNoAuthData } from './error';

export type CallableContextWithAuthData<R extends CallableContext = CallableContext> = Omit<R, 'auth'> & Required<Pick<R, 'auth'>>;

export function isContextWithAuthData<R extends CallableContext>(context: CallableContext): context is CallableContextWithAuthData<R> {
  return Boolean(context.auth !== null && context.auth?.uid);
}

export function assertIsContextWithAuthData<R extends CallableContext>(context: CallableContext): asserts context is CallableContextWithAuthData<R> {
  if (!isContextWithAuthData(context)) {
    throw unauthenticatedContextHasNoAuthData();
  }
}
