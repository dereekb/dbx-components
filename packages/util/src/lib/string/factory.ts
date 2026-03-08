import { type FactoryWithInput, type Factory, type FactoryWithRequiredInput } from '../getter';
import { type Maybe } from '../value';
import { transformStringFunction, type TransformStringFunctionConfig } from './transform';

/**
 * A factory that produces a string value with no input.
 */
export type StringFactory<K extends string = string> = Factory<K>;

/**
 * A function that converts a value of type T to a string.
 */
export type ToStringFunction<T, K extends string = string> = FactoryWithRequiredInput<K, T>;

/**
 * Wraps an existing factory with a {@link ToStringFunction} to produce strings from the factory's output.
 *
 * @param factory - the original value factory
 * @param toStringFunction - function to convert the factory's output to a string
 * @returns a new factory that produces string values
 */
export function stringFactoryFromFactory<T, K extends string = string>(factory: Factory<T>, toStringFunction: ToStringFunction<T, K>): StringFactory<K> {
  return () => toStringFunction(factory());
}

/**
 * A factory that returns a string based on the input date.
 */
export type StringFromDateFactory = FactoryWithInput<string, Maybe<Date>>;

/**
 * Configuration for creating a {@link StringFromDateFactory}.
 */
export interface StringFromDateConfig {
  /**
   * The number of digits to return from the end of the generated string.
   *
   * Is ignored if transformStringConfig.slice is set, or the value is 0.
   */
  readonly takeFromEnd?: number;
  /**
   * Optional/additional transformations to apply to the string.
   */
  readonly transformStringConfig?: Maybe<TransformStringFunctionConfig>;
  /**
   * The factory function to generate the initial string from the input date.
   */
  readonly dateToString: FactoryWithRequiredInput<string, Date>;
}

/**
 * Creates a factory that returns a string based on the input date.
 
 * @param config Configuration for the factory.
 * @returns A factory that returns a string based on the input date.
 */
export function stringFromDateFactory(config: StringFromDateConfig): StringFromDateFactory {
  const { takeFromEnd, transformStringConfig, dateToString } = config;

  const transformString = transformStringFunction({
    ...transformStringConfig,
    slice: transformStringConfig?.slice ?? (takeFromEnd ? { fromEnd: takeFromEnd } : undefined)
  });

  return (input?: Maybe<Date>) => {
    const date = input ?? new Date();
    const value = dateToString(date);
    return transformString(value);
  };
}

/**
 * Creates a factory that returns a string based on the Unix timestamp of the input date.
 *
 * @param digitsFromEnd The number of digits to return from the end of the generated string. Defaults to 7.
 * @returns A StringFromDateFactory.
 */
export function stringFromTimeFactory(digitsFromEnd: number = 7): StringFromDateFactory {
  return stringFromDateFactory({
    takeFromEnd: digitsFromEnd,
    dateToString: (date) => date.getTime().toString()
  });
}
