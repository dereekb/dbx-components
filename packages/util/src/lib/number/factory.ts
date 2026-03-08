import { asGetter, type Factory, type GetterOrValue } from '../getter/getter';

export type NumberFactory = Factory<number>;

/**
 * incrementingNumberFactory() configuration.
 */
export interface IncrementingNumberFactoryConfig {
  /**
   * Value to start at. Defaults to 0.
   */
  startAt?: number;
  /**
   * Getter to increase by. Defaults to 1.
   */
  increaseBy?: GetterOrValue<number>;
}

/**
 * Creates a factory that returns sequentially increasing numbers, starting from a configurable value and incrementing by a configurable step.
 *
 * @param config - Configuration with optional `startAt` (default 0) and `increaseBy` (default 1)
 * @returns A factory function that returns the next number in the sequence on each call
 *
 * @example
 * ```ts
 * const factory = incrementingNumberFactory({ startAt: 10, increaseBy: 5 });
 * factory(); // 10
 * factory(); // 15
 * factory(); // 20
 * ```
 */
export function incrementingNumberFactory(config: IncrementingNumberFactoryConfig = {}): NumberFactory {
  const { startAt: initial, increaseBy: inputIncreaseBy } = config;
  const increaseBy = asGetter(inputIncreaseBy ?? 1);

  let i = initial ?? 0;

  return () => {
    const x = i;
    i += increaseBy();
    return x;
  };
}
