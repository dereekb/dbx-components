import { isPromise } from './is';
import { type PromiseOrValue } from './promise.type';

/**
 * Applies a mapping function to a {@link PromiseOrValue}. If the input is a Promise, the
 * mapping is applied via `.then()`; if it is a synchronous value, the mapping is applied directly.
 *
 * @param input - A value or Promise to map over.
 * @param mapFn - The transformation function to apply.
 * @returns The mapped result, as a Promise if the input was a Promise, or synchronously otherwise.
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
