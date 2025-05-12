import { promiseReference } from '../promise';
import { type Destroyable } from '../lifecycle';
import { type Building } from '../value/build';
import { type Maybe } from '../value/maybe.type';
import { type Milliseconds } from './date';
import { BaseError } from 'make-error';

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

  const fn = (() => {
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

export type TimerState = 'running' | 'paused' | 'complete' | 'cancelled';

/**
 * Timer object that counts down a fixed duration amount.
 *
 * The timer is not required to start immediately.
 *
 * Once the timer has complete it cannot be reset.
 */
export interface Timer extends Destroyable {
  /**
   * Promise that resolves once the timer is complete, or throws an error if the timer is destroyed before it completes.
   */
  readonly promise: Promise<void>;

  /**
   * Current timer state.
   */
  readonly state: TimerState;

  /**
   * The time the Timer was created originally.
   */
  readonly createdAt: Date;

  /**
   * The last time the timer was paused.
   */
  readonly pausedAt?: Maybe<Date>;

  /**
   * The last started at date, if applicable.
   */
  readonly startedAt?: Maybe<Date>;

  /**
   * The configured duration.
   */
  readonly duration: Milliseconds;

  /**
   * The number of ms remaining.
   *
   * If the timer is paused, this returns null.
   *
   * If the timer is complete, this returns 0.
   */
  readonly durationRemaining: Maybe<Milliseconds>;

  /**
   * Completes the timer immediately.
   */
  completeNow(): void;

  /**
   * Starts the timer if it was not running. Does nothing if already running.
   */
  start(): void;

  /**
   * Stops the timer if it was running. Does nothing if already complete.
   */
  stop(): void;

  /**
   * Resets the timer to start now. If the timer is already complete then this does nothing.
   */
  reset(): void;

  /**
   * Sets a new duration on the timer. IF the timer is already complete this does nothing.
   *
   * If the new duration is less than the remaining duration it stops immediately.
   *
   * @param duration
   */
  setDuration(duration: Milliseconds): void;
}

/**
 * Error thrown when the timer is destroyed before it was completed.
 */
export class TimerCancelledError extends BaseError {
  constructor() {
    super(`The timer was destroyed before it was completed.`);
  }
}

/**
 * Creates a new Timer from the input duration.
 *
 * @param duration - The duration of the timer.
 * @param startImmediately - Whether the timer should start immediately. Defaults to true.
 * @returns The new Timer.
 */
export function makeTimer(duration: Milliseconds, startImmediately = true): Timer {
  const createdAt = new Date();

  let startedAt = new Date();
  let pausedAt: Maybe<Date> = undefined;

  let state: TimerState = 'paused';
  let currentDuration: Milliseconds = duration;

  const promiseRef = promiseReference<void>();

  const getDurationRemaining = (): Maybe<Milliseconds> => {
    let result: Maybe<Milliseconds>;

    switch (state) {
      case 'complete':
        result = 0;
        break;
      case 'running':
        result = Math.max(0, currentDuration - (new Date().getTime() - startedAt.getTime()));
        break;
      case 'paused':
        result = null;
        break;
    }

    return result;
  };

  const completeNow = () => {
    state = 'complete';
    promiseRef.resolve();
  };

  const checkComplete = () => {
    if (state !== 'complete' && getDurationRemaining() === 0) {
      completeNow();
    }
  };

  const enqueueCheck = () => {
    const remaining = getDurationRemaining();
    if (remaining != null && state !== 'complete') {
      setTimeout(() => {
        checkComplete();
        enqueueCheck();
      }, remaining);
    }
  };

  const start = () => {
    if (state === 'paused') {
      state = 'running';
      startedAt = new Date();
      enqueueCheck();
    }
  };

  const stop = () => {
    if (state === 'running') {
      state = 'paused';
      pausedAt = new Date();
    }
  };

  const reset = () => {
    if (state !== 'complete') {
      state = 'running';
      startedAt = new Date();
      enqueueCheck();
    }
  };

  const setDuration = (newDuration: Milliseconds) => {
    currentDuration = newDuration;
  };

  const destroy = () => {
    checkComplete();
    if (state !== 'complete') {
      state = 'cancelled';
      promiseRef.reject(new TimerCancelledError());
    }
  };

  if (startImmediately) {
    start();
    startedAt = createdAt;
  }

  return {
    get promise() {
      return promiseRef.promise;
    },
    get state() {
      return state;
    },
    get createdAt() {
      return createdAt;
    },
    get pausedAt() {
      return pausedAt;
    },
    get startedAt() {
      return startedAt;
    },
    get duration() {
      return currentDuration;
    },
    get durationRemaining() {
      return getDurationRemaining();
    },
    completeNow,
    start,
    stop,
    reset,
    setDuration,
    destroy
  };
}

/**
 * Toggles the input Timer's running state.
 *
 * @param timer
 * @param toggleRun
 */
export function toggleTimerRunning(timer: Timer, toggleRun?: boolean): void {
  toggleRun = toggleRun != null ? toggleRun : timer.state !== 'running';

  if (toggleRun) {
    timer.start();
  } else {
    timer.stop();
  }
}

/**
 * Returns the approximate end date of the given timer. If a timer is already complete, it returns the time for now.
 */
export function approximateTimerEndDate(timer: Timer): Maybe<Date> {
  const durationRemaining = timer.durationRemaining;

  if (durationRemaining != null) {
    return new Date(Date.now() + durationRemaining);
  } else {
    return null;
  }
}

// MARK: Compat
/**
 * @deprecated use makeTimer instead of timer.
 */
export const timer = makeTimer;
