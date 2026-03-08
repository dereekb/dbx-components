import { type Factory } from '../getter/getter';
import { incrementingNumberFactory } from '../number/factory';
import { NUMBER_STRING_DENCODER_64, type NumberStringDencoderString, type NumberStringDencoder, numberStringDencoderDecodedNumberValueFunction, type NumberStringDencoderNumber } from '../string/dencoder';
import { mapIdentityFunction } from '../value';
import { type IndexNumber } from '../value/indexed';
import { type Maybe } from '../value/maybe.type';

/**
 * A factory for generating a unique model identifier.
 */
export type ModelIdFactory = Factory<string>;

export interface SequentialIncrementingNumberStringModelIdFactoryConfig {
  /**
   * Optional transform function to modify the resulting value.
   */
  readonly transform?: (encodedValue: NumberStringDencoderString, index: NumberStringDencoderNumber) => NumberStringDencoderString;
  /**
   * The dencoder to use.
   *
   * Default to NUMBER_STRING_DENCODER_64.
   */
  readonly dencoder?: Maybe<NumberStringDencoder>;
  /**
   * The current index. Will start at this index + increaseBy.
   *
   * Is ignored if startAt is provided.
   */
  readonly currentIndex?: Maybe<IndexNumber | NumberStringDencoderString>;
  /**
   * The index to start at.
   */
  readonly startAt?: Maybe<IndexNumber | NumberStringDencoderString>;
  /**
   * The value to increase by for each generated value.
   *
   * Defaults to 1.
   */
  readonly increaseBy?: number;
}

/**
 * Creates a {@link ModelIdFactory} that generates sequential incrementing encoded string identifiers.
 *
 * Each call to the returned factory produces the next identifier in the sequence, encoded using the configured
 * {@link NumberStringDencoder} (defaults to base-64). Supports starting from a specific index or continuing
 * from a current index, and an optional transform for post-processing (e.g., padding).
 *
 * @param config - Configuration for the starting index, increment step, dencoder, and transform
 * @returns A factory function that returns the next encoded string identifier on each call
 * @throws Error if `increaseBy` is 0
 *
 * @example
 * ```ts
 * const factory = sequentialIncrementingNumberStringModelIdFactory({ startAt: 0 });
 * const first = factory(); // encoded representation of 0
 * const second = factory(); // encoded representation of 1
 * ```
 */
export function sequentialIncrementingNumberStringModelIdFactory(config: SequentialIncrementingNumberStringModelIdFactoryConfig = {}): ModelIdFactory {
  const { transform: inputTranformFunction, dencoder: inputDencoder, currentIndex, startAt: inputStartAt, increaseBy: inputIncreaseBy } = config;

  if (inputIncreaseBy === 0) {
    throw new Error('Cannot use 0 for increaseBy.');
  }

  const increaseBy = inputIncreaseBy ?? 1;
  const dencoder = inputDencoder ?? NUMBER_STRING_DENCODER_64;
  const dencoderNumberValue = numberStringDencoderDecodedNumberValueFunction(dencoder);
  const startAtFromCurrentIndex = currentIndex != null ? dencoderNumberValue(currentIndex) + increaseBy : undefined;
  const startAt = inputStartAt != null ? dencoderNumberValue(inputStartAt) : (startAtFromCurrentIndex ?? 0);
  const transform = inputTranformFunction ?? mapIdentityFunction();

  const numberFactory = incrementingNumberFactory({
    startAt,
    increaseBy
  });

  return () => {
    const nextIndex = numberFactory();
    const next = dencoder.encodeNumber(nextIndex);
    return transform(next, nextIndex);
  };
}
