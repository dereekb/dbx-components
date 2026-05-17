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
  readonly minute: number;
  readonly second: number;
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
