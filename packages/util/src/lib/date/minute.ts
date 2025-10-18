import { type Milliseconds, MS_IN_SECOND, type Seconds } from './date';

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
 * @param milliseconds
 * @returns
 */
export function millisecondsToMinutesAndSeconds(milliseconds: Milliseconds): MinutesAndSeconds {
  const seconds = Math.floor(milliseconds / MS_IN_SECOND);
  return secondsToMinutesAndSeconds(seconds);
}

/**
 * A pair of minutes and seconds.
 */
export interface MinutesAndSeconds {
  readonly minute: number;
  readonly second: number;
}

/**
 * Converts the input number of seconds to the equivalent in minutes and seconds.
 *
 * @param inputSeconds
 * @returns
 */
export function secondsToMinutesAndSeconds(inputSeconds: Seconds): MinutesAndSeconds {
  const minute = Math.floor(inputSeconds / 60);
  const second = inputSeconds % 60;

  return {
    minute,
    second
  };
}
