import { asGetter, GetterOrValue } from '../getter';
import { PromiseOrValue } from './promise';

export type UsePromiseUseFunction<I, O> = (value: I) => PromiseOrValue<O>;

/**
 * Uses a value returned from a promise.
 */
export type UsePromiseFunction<I> = <O>(useFn: UsePromiseUseFunction<I, O>) => Promise<O>;

/**
 * Creates a UsePromiseFactory.
 *
 * @param input
 * @returns
 */
export function usePromise<I>(input: GetterOrValue<Promise<I>>): UsePromiseFunction<I> {
  const _getter = asGetter(input);
  return <O>(useFn: UsePromiseUseFunction<I, O>) => _getter().then(useFn) as Promise<O>;
}
