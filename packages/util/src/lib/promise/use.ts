import { asGetter, GetterOrValue } from '../getter';
import { UseAsync } from '../value';

/**
 * Uses a cached promise value.
 */
export type UsePromiseFunction<I> = <O>(useFn: UseAsync<I, O>) => Promise<O>;

/**
 * Creates a UsePromiseFunction.
 *
 * @param input
 * @returns
 */
export function usePromise<I>(input: GetterOrValue<Promise<I>>): UsePromiseFunction<I> {
  const _getter = asGetter(input);
  return <O>(useFn: UseAsync<I, O>) => _getter().then(useFn) as Promise<O>;
}
