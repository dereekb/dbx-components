import { performTaskLoop } from './promise.loop';
import { waitForMs } from './wait';

/**
 * Configuration for the {@link poll} function.
 */
export interface PollConfig {
  /**
   * How long to wait between polling checks in milliseconds.
   *
   * Defaults to 250.
   */
  wait?: number;
  /**
   * Predicate function that returns `true` when the polling condition has been met.
   */
  check: () => boolean;
  /**
   * Maximum number of polling iterations before giving up.
   *
   * Defaults to `Number.MAX_SAFE_INTEGER`.
   */
  timesToGiveup?: number;
}

/**
 * Polls at a regular interval until a condition is met or the maximum number of attempts is reached.
 *
 * @param config - Polling configuration including check function, wait interval, and max attempts.
 * @param config.check - predicate function that returns true when the polling condition has been satisfied
 * @param config.wait - milliseconds to wait between polling iterations; defaults to 250
 * @param config.timesToGiveup - maximum number of polling iterations before giving up; defaults to `Number.MAX_SAFE_INTEGER`
 * @returns A Promise that resolves when the check condition returns `true` or the max attempts are exhausted.
 */
export function poll({ check, wait = 250, timesToGiveup = Number.MAX_SAFE_INTEGER }: PollConfig): Promise<void> {
  return performTaskLoop({
    next: (i) => (i > 0 ? waitForMs(wait) : Promise.resolve()),
    checkContinue: (_, i) => !check() && timesToGiveup > i
  });
}
