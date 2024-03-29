import { type AsyncGetterOrValue, type GetterOrValue, getValueFromGetter } from '../getter';
import { type PromiseOrValue } from '../promise/promise.type';
import { type MapFunction } from './map';
import { type Maybe } from './maybe.type';

// MARK: Use
/**
 * A map function with the intent of using the input value, and returning another value.
 */
export type UseValue<I, O = void> = MapFunction<I, O>;

export function useValue<I, O = void>(input: Maybe<I>, use: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>): Maybe<O> {
  let result: Maybe<O>;

  if (input != null) {
    result = use(input) as Maybe<O>;
  } else {
    result = getValueFromGetter(defaultValue);
  }

  return result;
}

export type UseFunction<I> = MappedUseFunction<I, I>;
export type MappedUseFunction<A, I> = <O = void>(input: Maybe<A>, use: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>) => Maybe<O>;

/**
 * Creates a MappedUseFunction.
 */
export function mappedUseFunction<A, I>(map: MapFunction<A, Maybe<I>>): MappedUseFunction<A, I> {
  return wrapUseFunction<A, I, I>(useValue as MappedUseFunction<A, I>, map as unknown as MapFunction<I, Maybe<I>>);
}

/**
 * Wraps another MappedUseFunction and maps the input values.
 */
export function wrapUseFunction<A, B, I>(mappedUseFn: MappedUseFunction<A, B>, map: MapFunction<B, Maybe<I>>): MappedUseFunction<A, I> {
  return (<O = void>(input: Maybe<A>, useFn: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>) => {
    return mappedUseFn<O>(input, ((value: B) => useValue(map(value), useFn, defaultValue)) as UseValue<B, O>, defaultValue);
  }) as MappedUseFunction<A, I>;
}

/**
 * Runs a pre-determined function on the input to return a value.
 */
export type UseContextFunction<I> = <O>(input: Maybe<I>) => Maybe<O>;

/**
 * Creates a UseContextFunction.
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
 * A map function with the intent of using the input value, and returning another value as a promise.
 */
export type UseAsync<I, O = void> = MapFunction<I, PromiseOrValue<O>>;

export async function useAsync<I, O = void>(input: Maybe<I>, use: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>): Promise<Maybe<O>> {
  let result: Maybe<O>;

  if (input != null) {
    result = (await use(input)) as Maybe<O>;
  } else {
    result = await getValueFromGetter(defaultValue);
  }

  return result;
}

export type UseAsyncFunction<I> = MappedUseAsyncFunction<I, I>;
export type MappedUseAsyncFunction<A, I> = <O = void>(input: Maybe<A>, use: UseAsync<I, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>) => Promise<Maybe<O>>;

/**
 * Creates a MappedUseFunction.
 */
export function mappedUseAsyncFunction<A, I>(map: MapFunction<A, Maybe<PromiseOrValue<Maybe<I>>>>): MappedUseAsyncFunction<A, I> {
  return wrapUseAsyncFunction<A, I, I>(useAsync as MappedUseAsyncFunction<A, I>, map as unknown as MapFunction<I, Maybe<PromiseOrValue<Maybe<I>>>>);
}

/**
 * Wraps another MappedUseFunction or MappedUseAsyncFunction and maps the input values.
 */
export function wrapUseAsyncFunction<A, B, I>(mappedUsePromiseFn: MappedUseAsyncFunction<A, B>, map: MapFunction<B, Maybe<PromiseOrValue<Maybe<I>>>>): MappedUseAsyncFunction<A, I> {
  return (<O = void>(input: Maybe<A>, useFn: UseAsync<I, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>) => {
    return mappedUsePromiseFn<O>(input, (async (value: B) => useValue(await map(value), useFn, defaultValue)) as UseAsync<B, O>, defaultValue);
  }) as MappedUseAsyncFunction<A, I>;
}
