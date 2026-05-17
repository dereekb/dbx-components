import { type AsyncGetterOrValue, type GetterOrValue, getValueFromGetter } from '../getter';
import { type PromiseOrValue } from '../promise/promise.type';
import { type MapFunction } from './map';
import { type Maybe } from './maybe.type';

// MARK: Use
/**
 * A MapFunction whose primary intent is to consume (use) the input value, optionally producing an output.
 * Defaults to void when no output is needed, making it suitable for side-effect-style consumers.
 */
export type UseValue<I, O = void> = MapFunction<I, O>;

/**
 * Applies the `use` function to the input if it is defined, otherwise returns the `defaultValue`.
 * Provides a safe pattern for consuming nullable values with a fallback.
 *
 * @param input - The possibly null/undefined value to consume.
 * @param use - Function to apply when input is defined.
 * @param defaultValue - Fallback value or getter used when input is null/undefined.
 * @returns The result of `use`, or the default value if input was null/undefined.
 *
 * @example
 * ```ts
 * const result = useValue(5, (x) => x * 2);
 * // result === 10
 *
 * const fallback = useValue(undefined, (x: number) => x * 2, 0);
 * // fallback === 0
 * ```
 */
export function useValue<I, O = void>(input: Maybe<I>, use: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>): Maybe<O> {
  let result: Maybe<O>;

  if (input != null) {
    result = use(input) as Maybe<O>;
  } else {
    result = getValueFromGetter(defaultValue);
  }

  return result;
}

/**
 * A MappedUseFunction where no mapping step is applied; the input type is used directly.
 */
export type UseFunction<I> = MappedUseFunction<I, I>;

/**
 * A function that first maps an input of type `A` to type `I`, then applies a {@link UseValue} consumer
 * to the mapped result. Falls back to a default value when the input is null/undefined.
 */
export type MappedUseFunction<A, I> = <O = void>(input: Maybe<A>, use: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>) => Maybe<O>;

/**
 * Creates a {@link MappedUseFunction} that transforms the input through the given `map` before applying the consumer.
 * If the mapped result is null/undefined, the default value is returned instead.
 *
 * @param map - Transforms the outer input into the type expected by the consumer.
 * @returns A MappedUseFunction that maps then consumes.
 *
 * @dbxUtil
 * @dbxUtilCategory value
 * @dbxUtilKind factory
 * @dbxUtilTags value, use, map, factory, optional, fallback
 * @dbxUtilRelated wrap-use-function, use-context-function
 *
 * @example
 * ```ts
 * const mapFn = (n: number) => String(n);
 * const mappedUseFn = mappedUseFunction(mapFn);
 *
 * const result = mappedUseFn(1, () => 'hello');
 * // result === 'hello'
 *
 * const fallback = mappedUseFn(undefined, () => 'wrong', 'default');
 * // fallback === 'default'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function mappedUseFunction<A, I>(map: MapFunction<A, Maybe<I>>): MappedUseFunction<A, I> {
  return wrapUseFunction<A, I, I>(useValue as MappedUseFunction<A, I>, map as unknown as MapFunction<I, Maybe<I>>);
}

/**
 * Wraps an existing {@link MappedUseFunction} with an additional mapping step, allowing further transformation
 * of the intermediate value before it reaches the consumer.
 *
 * @param mappedUseFn - The existing mapped use function to wrap.
 * @param map - Additional transformation applied to the intermediate value.
 * @returns A new MappedUseFunction with the extra mapping layer.
 *
 * @dbxUtil
 * @dbxUtilCategory value
 * @dbxUtilKind factory
 * @dbxUtilTags value, use, map, wrap, compose, factory
 * @dbxUtilRelated mapped-use-function, use-value
 *
 * @__NO_SIDE_EFFECTS__
 */
export function wrapUseFunction<A, B, I>(mappedUseFn: MappedUseFunction<A, B>, map: MapFunction<B, Maybe<I>>): MappedUseFunction<A, I> {
  return (<O = void>(input: Maybe<A>, useFn: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>) => {
    return mappedUseFn<O>(input, ((value: B) => useValue(map(value), useFn, defaultValue)) as UseValue<B, O>, defaultValue);
  }) as MappedUseFunction<A, I>;
}

/**
 * A pre-configured consumer function that accepts an input and returns a value, encapsulating both the
 * consumer logic and default value in a single callable.
 */
export type UseContextFunction<I> = <O>(input: Maybe<I>) => Maybe<O>;

/**
 * Creates a {@link UseContextFunction} by binding a consumer and optional default value, so callers
 * only need to supply the input.
 *
 * @param use - The consumer function to bind.
 * @param defaultValue - Fallback when input is null/undefined.
 * @returns A single-argument function that applies the bound consumer.
 *
 * @dbxUtil
 * @dbxUtilCategory value
 * @dbxUtilKind factory
 * @dbxUtilTags value, use, context, factory, bind, default
 * @dbxUtilRelated use-value, mapped-use-function
 *
 * @__NO_SIDE_EFFECTS__
 */
export function useContextFunction<I, O>(use: UseValue<I, O>, defaultValue?: GetterOrValue<O>): UseContextFunction<I> {
  return ((input: Maybe<I>) => {
    let result: Maybe<O>;

    if (input != null) {
      result = use(input);
    } else {
      result = getValueFromGetter(defaultValue);
    }

    return result;
  }) as UseContextFunction<I>;
}

// MARK: Async
/**
 * Async variant of {@link UseValue} that may return a Promise, allowing asynchronous consumption of values.
 */
export type UseAsync<I, O = void> = MapFunction<I, PromiseOrValue<O>>;

/**
 * Async variant of {@link useValue}. Awaits the consumer result and supports async default value getters.
 *
 * @param input - The possibly null/undefined value to consume.
 * @param use - Async-capable consumer function.
 * @param defaultValue - Fallback value or getter when input is null/undefined.
 * @returns A Promise resolving to the consumer result or the default value.
 *
 * @example
 * ```ts
 * const result = await useAsync(1, (x) => Promise.resolve(x * 2));
 * // result === 2
 * ```
 */
export async function useAsync<I, O = void>(input: Maybe<I>, use: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>): Promise<Maybe<O>> {
  let result: Maybe<O>;

  if (input != null) {
    result = (await use(input)) as Maybe<O>;
  } else {
    result = getValueFromGetter(defaultValue);
  }

  return result;
}

/**
 * A {@link MappedUseAsyncFunction} where no mapping step is applied; the input type is used directly.
 */
export type UseAsyncFunction<I> = MappedUseAsyncFunction<I, I>;

/**
 * Async variant of {@link MappedUseFunction} that maps, then asynchronously consumes the result.
 */
export type MappedUseAsyncFunction<A, I> = <O = void>(input: Maybe<A>, use: UseAsync<I, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>) => Promise<Maybe<O>>;

/**
 * Creates a {@link MappedUseAsyncFunction} that transforms the input through the given `map` (which may return a Promise)
 * before applying the async consumer.
 *
 * @param map - Transforms the outer input, optionally asynchronously, into the type expected by the consumer.
 * @returns A MappedUseAsyncFunction that maps then asynchronously consumes.
 *
 * @dbxUtil
 * @dbxUtilCategory value
 * @dbxUtilKind factory
 * @dbxUtilTags value, use, async, map, factory, promise
 * @dbxUtilRelated wrap-use-async-function, mapped-use-function
 *
 * @example
 * ```ts
 * const mapFn = (n: number) => String(n);
 * const mappedUseAsyncFn = mappedUseAsyncFunction(mapFn);
 *
 * const result = await mappedUseAsyncFn(1, () => Promise.resolve('hello'));
 * // result === 'hello'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function mappedUseAsyncFunction<A, I>(map: MapFunction<A, Maybe<PromiseOrValue<Maybe<I>>>>): MappedUseAsyncFunction<A, I> {
  return wrapUseAsyncFunction<A, I, I>(useAsync as MappedUseAsyncFunction<A, I>, map as unknown as MapFunction<I, Maybe<PromiseOrValue<Maybe<I>>>>);
}

/**
 * Wraps an existing {@link MappedUseAsyncFunction} with an additional async-capable mapping step,
 * allowing further transformation of the intermediate value before it reaches the consumer.
 *
 * @param mappedUsePromiseFn - The existing async mapped use function to wrap.
 * @param map - Additional transformation (sync or async) applied to the intermediate value.
 * @returns A new MappedUseAsyncFunction with the extra mapping layer.
 *
 * @dbxUtil
 * @dbxUtilCategory value
 * @dbxUtilKind factory
 * @dbxUtilTags value, use, async, map, wrap, compose, factory, promise
 * @dbxUtilRelated mapped-use-async-function, wrap-use-function
 *
 * @__NO_SIDE_EFFECTS__
 */
export function wrapUseAsyncFunction<A, B, I>(mappedUsePromiseFn: MappedUseAsyncFunction<A, B>, map: MapFunction<B, Maybe<PromiseOrValue<Maybe<I>>>>): MappedUseAsyncFunction<A, I> {
  return (<O = void>(input: Maybe<A>, useFn: UseAsync<I, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>) => {
    return mappedUsePromiseFn<O>(input, (async (value: B) => useValue(await map(value), useFn, defaultValue)) as UseAsync<B, O>, defaultValue);
  }) as MappedUseAsyncFunction<A, I>;
}
