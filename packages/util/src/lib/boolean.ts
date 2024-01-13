import { type Factory } from './getter/getter';

// MARK: Reduce
export function reduceBooleansWithAnd(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithAndFn(emptyArrayValue)(array);
}

export function reduceBooleansWithOr(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithOrFn(emptyArrayValue)(array);
}

export function reduceBooleansWithAndFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a && b, emptyArrayValue);
}

export function reduceBooleansWithOrFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a || b, emptyArrayValue);
}

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
 * Creates a new BooleanFactory.
 *
 * @param config
 * @returns
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
 * Returns a random boolean.
 *
 * @param chance Number between 0 and 100
 * @returns
 */
export function randomBoolean(chance: BooleanChance = 50): boolean {
  return booleanFactory({ chance })();
}
