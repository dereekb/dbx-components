import { FactoryWithInput, type Factory, type FactoryWithRequiredInput } from '../getter';
import { Maybe } from '../value';
import { transformStringFunction, TransformStringFunctionConfig } from './transform';

export type StringFactory<K extends string = string> = Factory<K>;

export type ToStringFunction<T, K extends string = string> = FactoryWithRequiredInput<K, T>;

/**
 * Wraps another factory with a ToStringFactory function to generate strings from the original factory.
 *
 * @param factory
 * @param toStringFunction
 * @returns
 */
export function stringFactoryFromFactory<T, K extends string = string>(factory: Factory<T>, toStringFunction: ToStringFunction<T, K>): StringFactory<K> {
  return () => toStringFunction(factory());
}

/**
 * A factory that returns a string based on the input date.
 */
export type StringFromDateFactory = FactoryWithInput<string, Maybe<Date>>;

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
