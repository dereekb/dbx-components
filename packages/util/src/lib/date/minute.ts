import { type NumberRounding, numberFactorConverter } from '../number/round';
import { type Milliseconds, type Minutes, MS_IN_MINUTE, MS_IN_SECOND, type Seconds } from './date';

/**
 * Converts the input number of milliseconds to whole minutes by flooring the result.
 *
 * @param milliseconds - Duration to truncate down to whole minutes.
 * @returns Floor of the equivalent minutes count.
 *
 * @example
 * ```ts
 * millisecondsToMinutes(180000); // 3
 * millisecondsToMinutes(90000);  // 1
 * ```
 */
export function millisecondsToMinutes(milliseconds: Milliseconds): Minutes {
  return Math.floor(milliseconds / MS_IN_MINUTE);
}

/**
 * A pair of minutes and seconds.
 */
export interface MinutesAndSeconds {
  readonly minute: Minutes;
  readonly second: Seconds;
}

/**
 * Converts the input number of milliseconds to the equivalent in minutes and seconds.
 *
 * Rounds down to the nearest second.
 *
 * @param milliseconds - Duration to split into minute + second components.
 * @returns Minute-second pair representing the same duration (seconds floored).
 */
export function millisecondsToMinutesAndSeconds(milliseconds: Milliseconds): MinutesAndSeconds {
  const seconds = Math.floor(milliseconds / MS_IN_SECOND);
  return secondsToMinutesAndSeconds(seconds);
}

/**
 * Converts the input number of seconds to the equivalent in minutes and seconds.
 *
 * @param inputSeconds - Duration to split into minute + second components.
 * @returns Minute-second pair representing the same duration.
 */
export function secondsToMinutesAndSeconds(inputSeconds: Seconds): MinutesAndSeconds {
  const minute = Math.floor(inputSeconds / 60);
  const second = inputSeconds % 60;

  return {
    minute,
    second
  };
}

/**
 * A number of Minutes expressed in increments of a fixed size, rounded to an integer.
 *
 * For example, with a 15 minute increment and floor rounding: 0 is 0, 15 is 1, 50 is 3, and 720 is 48.
 *
 * Is always an integer.
 *
 * Optional generic typing exists for communicating the increment size in minutes.
 *
 * Use minutesIncrementConverter() to convert between Minutes and MinutesIncrement values.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type MinutesIncrement<T extends Minutes = Minutes> = number;

/**
 * A MinutesIncrement for a 15 minute increment, which is a duration expressed in quarter hours.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type FifteenMinuteIncrement = MinutesIncrement<15>;

/**
 * minutesIncrementConverter() configuration.
 */
export interface MinutesIncrementConverterConfig<T extends Minutes = Minutes> {
  /**
   * Size of each increment in minutes. Must be a positive integer, unless allowFractionalIncrement is true.
   */
  readonly increment: T;
  /**
   * Rounding applied when reducing Minutes to a MinutesIncrement.
   *
   * Defaults to 'floor', which reduces Minutes to the number of whole increments it contains.
   */
  readonly round?: Exclude<NumberRounding, 'none'>;
  /**
   * Whether or not to allow an increment that is not an integer, such as 7.5. The increment must still be positive.
   *
   * MinutesIncrement values are still integers, but the Minutes produced by expanding and rounding may be fractional.
   *
   * Not supported by minuteOfDayIncrementConverter(), since a MinuteOfDay is always an integer.
   *
   * Defaults to false.
   */
  readonly allowFractionalIncrement?: boolean;
}

export type MinutesIncrementConverterInput<T extends Minutes = Minutes> = MinutesIncrementConverterConfig<T> | T;

/**
 * Converts between Minutes and MinutesIncrement values for a specific increment size.
 */
export interface MinutesIncrementConverter<T extends Minutes = Minutes> {
  readonly increment: T;
  /**
   * Reduces the Minutes to a MinutesIncrement using the configured rounding.
   */
  readonly reduce: (minutes: Minutes) => MinutesIncrement<T>;
  /**
   * Expands the MinutesIncrement to Minutes.
   *
   * The result is fractional if the increment is fractional.
   */
  readonly expand: (increment: MinutesIncrement<T>) => Minutes;
  /**
   * Rounds the Minutes to a multiple of the increment using the configured rounding. Equivalent to expand(reduce(minutes)).
   */
  readonly round: (minutes: Minutes) => Minutes;
}

/**
 * Creates a MinutesIncrementConverter that reduces Minutes to MinutesIncrement values, expands them back, and rounds Minutes to a multiple of the increment.
 *
 * Accepts either an increment size (uses 'floor' rounding) or a full config with the increment, rounding type, and whether or not to allow a fractional increment.
 *
 * @param input - Increment size in minutes, or full configuration.
 * @returns Converter that reduces, expands, and rounds Minutes by the increment.
 * @throws {Error} If the increment is not positive, or is not an integer and allowFractionalIncrement is not true.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind factory
 * @dbxUtilTags date, minute, duration, increment, round, convert, factory
 * @dbxUtilRelated minute-of-day-increment-converter, number-factor-converter
 *
 * @example
 * ```ts
 * const converter = minutesIncrementConverter(15);
 * converter.reduce(50); // 3
 * converter.expand(3); // 45
 * converter.round(50); // 45
 *
 * minutesIncrementConverter({ increment: 15, round: 'ceil' }).round(50); // 60
 *
 * minutesIncrementConverter({ increment: 7.5, allowFractionalIncrement: true }).round(50); // 45
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function minutesIncrementConverter<T extends Minutes = Minutes>(input: MinutesIncrementConverterInput<T>): MinutesIncrementConverter<T> {
  const config: MinutesIncrementConverterConfig<T> = typeof input === 'number' ? { increment: input } : input;
  const { increment, round = 'floor', allowFractionalIncrement = false } = config;

  if (!(increment > 0)) {
    throw new Error('Increment must be positive.');
  } else if (!allowFractionalIncrement && !Number.isInteger(increment)) {
    throw new Error('Increment must be an integer when allowFractionalIncrement is not true.');
  }

  const factorConverter = numberFactorConverter({ factor: increment, round });

  return {
    increment,
    reduce: factorConverter.reduce,
    expand: factorConverter.expand,
    round: factorConverter.round
  };
}
