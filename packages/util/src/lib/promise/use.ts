import { asGetter, type GetterOrValue } from '../getter';
import { type UseAsync } from '../value';

/**
 * A function that resolves a cached Promise value and passes it to the given async consumer,
 * returning the consumer's result.
 */
export type UsePromiseFunction<I> = <O>(useFn: UseAsync<I, O>) => Promise<O>;

/**
 * Creates a {@link UsePromiseFunction} that resolves the input promise and passes the result
 * to any consumer function provided at call time.
 *
 * @param input - A Promise or a getter that returns a Promise, whose resolved value will be passed to consumers.
 * @returns A function that accepts an async consumer and returns the consumer's result.
 */
export function usePromise<I>(input: GetterOrValue<Promise<I>>): UsePromiseFunction<I> {
  const _getter = asGetter(input);
  return <O>(useFn: UseAsync<I, O>) => _getter().then(useFn) as Promise<O>;
}
