import { Building } from '../value/build';
import { type Maybe } from '../value/maybe.type';
import { type Milliseconds } from './date';

/**
 * Returns the number of invocations that have occurred since the period started.
 *
 * When a new period has started, returns 0.
 */
export type TimePeriodCounter = (() => number) & {
  readonly _timePeriodLength: Milliseconds;
  readonly _timePeriodCount: number;
  readonly _lastTimePeriodStart: Date;
  readonly _nextTimePeriodEnd: Date;
  /**
   * Resets the counter.
   *
   * @returns the new period end time.
   */
  readonly _reset: (start?: Date) => Date;
};

export function timePeriodCounter(timePeriodLength: number, lastTimePeriodStart?: Maybe<Date>): TimePeriodCounter {
  function reset(inputStart: Maybe<Date>) {
    const start = inputStart ?? new Date();
    fn._timePeriodCount = 0;
    fn._lastTimePeriodStart = start;
    fn._nextTimePeriodEnd = new Date(start.getTime() + timePeriodLength);
    return fn._nextTimePeriodEnd;
  }

  let fn = (() => {
    const now = new Date();

    if (now > (fn._nextTimePeriodEnd as Date)) {
      reset(now);
    } else {
      (fn._timePeriodCount as number) += 1;
    }

    return fn._timePeriodCount;
  }) as Building<TimePeriodCounter>;

  fn._timePeriodLength = timePeriodLength;
  reset(lastTimePeriodStart);
  fn._timePeriodCount = -1;
  fn._reset = reset;

  return fn as TimePeriodCounter;
}
