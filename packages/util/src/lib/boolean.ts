import { type Factory } from './getter/getter';
import { type Maybe, type MaybeNot } from './value/maybe.type';

// MARK: Types
/**
 * Type representing whether something is valid.
 */
export type IsValid = boolean;

/**
 * Type representing whether something is equal to something else.
 */
export type IsEqual = boolean;

/**
 * Type representing whether something has been modified.
 */
export type IsModified = boolean;

// MARK: Maybe
/**
 * If a non-null boolean value is provided, returns the opposite.
 */
export function invertMaybeBoolean(x: true): false;
export function invertMaybeBoolean(x: false): true;
export function invertMaybeBoolean(x: boolean): boolean;
export function invertMaybeBoolean(x: MaybeNot): MaybeNot;
export function invertMaybeBoolean(x: Maybe<boolean>): Maybe<boolean>;
export function invertMaybeBoolean(x: Maybe<boolean>): Maybe<boolean> {
  return x == null ? x : !x;
}

// MARK: Reduce
/**
 * Reduces an array of booleans with the logical AND operation.
 *
 * @param array - Array of boolean values to reduce.
 * @param emptyArrayValue - Value to return if the array is empty. If not provided and the array is empty, a TypeError will be thrown.
 * @returns The result of ANDing all boolean values in the array.
 */
export function reduceBooleansWithAnd(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithAndFn(emptyArrayValue)(array);
}

/**
 * Reduces an array of booleans with the logical OR operation.
 *
 * @param array - Array of boolean values to reduce.
 * @param emptyArrayValue - Value to return if the array is empty. If not provided and the array is empty, a TypeError will be thrown.
 * @returns The result of ORing all boolean values in the array.
 */
export function reduceBooleansWithOr(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithOrFn(emptyArrayValue)(array);
}

/**
 * Creates a function that reduces an array of booleans with the logical AND operation.
 *
 * @param emptyArrayValue - Value to return if the array is empty. If not provided and the array is empty, the returned function will throw a TypeError.
 * @returns A function that takes an array of booleans and returns the result of ANDing them.
 */
export function reduceBooleansWithAndFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a && b, emptyArrayValue);
}

/**
 * Creates a function that reduces an array of booleans with the logical OR operation.
 *
 * @param emptyArrayValue - Value to return if the array is empty. If not provided and the array is empty, the returned function will throw a TypeError.
 * @returns A function that takes an array of booleans and returns the result of ORing them.
 */
export function reduceBooleansWithOrFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a || b, emptyArrayValue);
}

/**
 * Creates a function that reduces an array of booleans using a custom reduce function.
 *
 * @param reduceFn - Function that takes two boolean values and returns a single boolean.
 * @param emptyArrayValue - Value to return if the array is empty. If not provided and the array is empty, the returned function will throw a TypeError because `Array.prototype.reduce` on an empty array without an initial value throws.
 * @returns A function that takes an array of booleans and returns the result of reducing them.
 */
export function reduceBooleansFn(reduceFn: (a: boolean, b: boolean) => boolean, emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  const rFn = (array: boolean[]) => Boolean(array.reduce(reduceFn));

  if (emptyArrayValue != null) {
    return (array: boolean[]) => (array.length ? rFn(array) : emptyArrayValue);
  } else {
    return rFn;
  }
}

// MARK: Random
/**
 * Factory that generates boolean values.
 */
export type BooleanFactory = Factory<boolean>;

/**
 * Number from 0.0 to 100.0 used for the chance to return true.
 */
export type BooleanTrueChance = number;

/**
 * Configuration for `booleanFactory`.
 */
export interface BooleanFactoryConfig {
  /**
   * Chance of returning true, expressed as a number from 0.0 to 100.0.
   * For example, a value of 75 means a 75% chance of returning true.
   */
  readonly chance: BooleanTrueChance;
}

/**
 * Creates a new BooleanFactory that generates random boolean values based on chance.
 *
 * @param config - Configuration for the boolean factory, including the chance of returning true.
 * @returns A factory function (`BooleanFactory`) that generates random boolean values based on the configured chance.
 */
export function booleanFactory(config: BooleanFactoryConfig): BooleanFactory {
  const { chance: inputChance } = config;
  const chance = inputChance / 100;
  return () => {
    const roll = Math.random();
    const result = roll <= chance;
    return result;
  };
}

/**
 * Returns a random boolean based on the specified chance.
 *
 * @param chance - Number between 0.0 and 100.0 representing the percentage chance of returning true (default: 50, i.e., 50%).
 * @returns A random boolean value with the specified probability of being true.
 */
export function randomBoolean(chance: BooleanTrueChance = 50): boolean {
  return booleanFactory({ chance })();
}

/**
 * Converts the input string to a boolean.
 *
 * Case-insensitive matches for yes/y/t/true and no/n/f/false.
 *
 * @param value - The string to convert to a boolean.
 * @param defaultValue - The default value to return if the string cannot be converted to a boolean (default: undefined).
 * @returns The boolean value corresponding to the string, or the default value if the string cannot be converted.
 */
export function stringToBoolean(value: Maybe<string>): Maybe<boolean>;
export function stringToBoolean(value: Maybe<string>, defaultValue: boolean): boolean;
export function stringToBoolean(value: Maybe<string>, defaultValue?: Maybe<boolean>): Maybe<boolean>;
export function stringToBoolean(value: Maybe<string>, defaultValue?: Maybe<boolean>): Maybe<boolean> {
  let result: Maybe<boolean> = defaultValue;

  if (value) {
    switch (value.toLowerCase()) {
      case 'y':
      case 'yes':
      case 't':
      case 'true':
        result = true;
        break;
      case 'n':
      case 'no':
      case 'f':
      case 'false':
        result = false;
        break;
    }
  }

  return result;
}
