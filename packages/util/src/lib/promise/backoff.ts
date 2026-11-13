import { type Milliseconds } from '../date/date';
import { type Maybe } from '../value/maybe.type';

/**
 * How {@link exponentialBackoffDelay} randomizes a delay.
 *
 * - `equal`: uniform in `[d/2, d]`, so concurrent retries spread out but never retry sooner than half the delay.
 * - `none`: exactly `d`.
 */
export type ExponentialBackoffJitter = 'equal' | 'none';

export const DEFAULT_EXPONENTIAL_BACKOFF_INITIAL_DELAY: Milliseconds = 1000;
export const DEFAULT_EXPONENTIAL_BACKOFF_MAX_DELAY: Milliseconds = 60 * 1000;
export const DEFAULT_EXPONENTIAL_BACKOFF_FACTOR = 2;

export interface ExponentialBackoffDelayInput {
  /**
   * The retry number: 1 for the first retry.
   */
  readonly attempt: number;
  /**
   * The delay before the first retry. Defaults to 1 second.
   */
  readonly initialDelay?: Maybe<Milliseconds>;
  /**
   * The longest delay. Defaults to 60 seconds.
   */
  readonly maxDelay?: Maybe<Milliseconds>;
  /**
   * How much the delay grows per retry. Defaults to 2.
   */
  readonly factor?: Maybe<number>;
  /**
   * Defaults to `equal`.
   */
  readonly jitter?: Maybe<ExponentialBackoffJitter>;
  /**
   * Returns a number in `[0, 1)`. Defaults to `Math.random`; a spec passes a fixed one.
   */
  readonly random?: Maybe<() => number>;
}

/**
 * Returns how long to wait before a retry: `initialDelay * factor^(attempt - 1)`, capped at `maxDelay`, then jittered.
 *
 * @param input - The attempt number and backoff settings.
 * @returns The delay in whole milliseconds.
 *
 * @dbxUtil
 * @dbxUtilCategory promise
 * @dbxUtilTags promise, retry, backoff, exponential, jitter, delay, throttle
 * @dbxUtilRelated wait
 *
 * @example
 * ```ts
 * exponentialBackoffDelay({ attempt: 1, jitter: 'none' }); // 1000
 * exponentialBackoffDelay({ attempt: 3, jitter: 'none' }); // 4000
 * exponentialBackoffDelay({ attempt: 3 }); // between 2000 and 4000
 * ```
 */
export function exponentialBackoffDelay(input: ExponentialBackoffDelayInput): Milliseconds {
  const initialDelay = input.initialDelay ?? DEFAULT_EXPONENTIAL_BACKOFF_INITIAL_DELAY;
  const maxDelay = input.maxDelay ?? DEFAULT_EXPONENTIAL_BACKOFF_MAX_DELAY;
  const factor = input.factor ?? DEFAULT_EXPONENTIAL_BACKOFF_FACTOR;
  const random = input.random ?? Math.random;
  const exponent = Math.max(0, input.attempt - 1);
  const delay = Math.min(maxDelay, initialDelay * factor ** exponent);
  const jittered = input.jitter === 'none' ? delay : delay / 2 + random() * (delay / 2);
  return Math.round(jittered);
}
