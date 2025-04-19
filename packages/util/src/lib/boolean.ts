import { type Factory } from './getter/getter';

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

// MARK: Reduce
/**
 * Reduces an array of booleans with the logical AND operation.
 *
 * @param array - Array of boolean values to reduce
 * @param emptyArrayValue - Value to return if the array is empty (default: undefined which becomes false)
 * @returns The result of ANDing all boolean values in the array
 */
export function reduceBooleansWithAnd(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithAndFn(emptyArrayValue)(array);
}

/**
 * Reduces an array of booleans with the logical OR operation.
 *
 * @param array - Array of boolean values to reduce
 * @param emptyArrayValue - Value to return if the array is empty (default: undefined which becomes false)
 * @returns The result of ORing all boolean values in the array
 */
export function reduceBooleansWithOr(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithOrFn(emptyArrayValue)(array);
}

/**
 * Creates a function that reduces an array of booleans with the logical AND operation.
 *
 * @param emptyArrayValue - Value to return if the array is empty (default: undefined which becomes false)
 * @returns A function that takes an array of booleans and returns the result of ANDing them
 */
export function reduceBooleansWithAndFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a && b, emptyArrayValue);
}

/**
 * Creates a function that reduces an array of booleans with the logical OR operation.
 *
 * @param emptyArrayValue - Value to return if the array is empty (default: undefined which becomes false)
 * @returns A function that takes an array of booleans and returns the result of ORing them
 */
export function reduceBooleansWithOrFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a || b, emptyArrayValue);
}

/**
 * Creates a function that reduces an array of booleans using a custom reduce function.
 *
 * @param reduceFn - Function that takes two boolean values and returns a single boolean
 * @param emptyArrayValue - Value to return if the array is empty (default: undefined which uses the standard reduce behavior)
 * @returns A function that takes an array of booleans and returns the result of reducing them
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
export type BooleanChance = number;

export interface BooleanFactoryConfig {
  /**
   * Chance of returning true.
   */
  chance: BooleanChance;
}

/**
 * Creates a new BooleanFactory that generates random boolean values based on chance.
 *
 * @param config - Configuration for the boolean factory, including the chance of returning true
 * @returns A factory function that generates random boolean values
 */
export function booleanFactory(config: BooleanFactoryConfig) {
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
 * @param chance - Number between 0 and 100 representing the percentage chance of returning true (default: 50)
 * @returns A random boolean value with the specified probability of being true
 */
export function randomBoolean(chance: BooleanChance = 50): boolean {
  return booleanFactory({ chance })();
}
