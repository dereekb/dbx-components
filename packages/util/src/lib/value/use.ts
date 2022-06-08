import { GetterOrValue, getValueFromGetter } from '../getter';
import { MapFunction } from './map';
import { Maybe } from './maybe.type';

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
  return (<O = void>(input: Maybe<A>, useFn: UseValue<I, O>, defaultValue?: Maybe<GetterOrValue<O>>) => {
    return useValue<A, O>(input, ((value: A) => useValue(map(value), useFn, defaultValue)) as UseValue<A, O>, defaultValue);
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
