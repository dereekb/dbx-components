import { asGetter, ObjectOrGetter } from '@dereekb/util';
import { Factory } from './../getter/getter';

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
  increaseBy?: ObjectOrGetter<number>;
}

/**
 * Creates a factory that returns increasing numbers.
 * 
 * @param config 
 * @returns 
 */
export function incrementingNumberFactory(config: IncrementingNumberFactoryConfig = {}): Factory<number> {
  const { startAt: initial, increaseBy: inputIncreaseBy } = config;
  const increaseBy = asGetter(inputIncreaseBy ?? 1);

  let i = initial ?? 0;

  return () => {
    const x = i;
    i += increaseBy();
    return x;
  };
}
