import { isPromise } from './is';
import { type PromiseOrValue } from './promise.type';

/**
 * Performs a mapping function on the input PromiseOrValue value.
 *
 * @param input
 * @param mapFn
 */
export function mapPromiseOrValue<I, O>(input: Promise<I>, mapFn: (input: I) => O): Promise<O>;
export function mapPromiseOrValue<I, O>(input: I, mapFn: (input: I) => O): O;
export function mapPromiseOrValue<I, O>(input: PromiseOrValue<I>, mapFn: (input: I) => O): PromiseOrValue<O>;
export function mapPromiseOrValue<I, O>(input: PromiseOrValue<I>, mapFn: (input: I) => O): unknown {
  if (isPromise(input)) {
    return input.then(mapFn);
  } else {
    return mapFn(input);
  }
}
