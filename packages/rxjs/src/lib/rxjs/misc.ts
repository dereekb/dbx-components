import { MakeRandomFunction, makeRandomFunction, RandomNumberFunction } from '@dereekb/util';
import { MonoTypeOperatorFunction, tap, delayWhen, timer, SchedulerLike, asyncScheduler } from 'rxjs';

/**
 * Used to log a message to the console.
 *
 * @param messageOrFunction
 * @returns
 */
export function tapLog<T = unknown>(message: string | number, consoleLogFn?: 'log' | 'warn' | 'error'): MonoTypeOperatorFunction<T>;
export function tapLog<T = unknown>(messageFunction: (value: T) => unknown[], consoleLogFn?: 'log' | 'warn' | 'error'): MonoTypeOperatorFunction<T>;
export function tapLog<T = unknown>(messageOrFunction: (string | number) | ((value: T) => unknown[]), consoleLogFn: 'log' | 'warn' | 'error' = 'log'): MonoTypeOperatorFunction<T> {
  let operator: MonoTypeOperatorFunction<T>;

  if (typeof messageOrFunction === 'function') {
    operator = tap((x) => console[consoleLogFn].apply(undefined, messageOrFunction(x)));
  } else {
    operator = tap((x) => console[consoleLogFn](`${messageOrFunction}`, x));
  }

  return operator;
}

/**
 * Used to make a random delay for each observable value.
 *
 * @param maxOrArgs
 * @returns
 */
export function randomDelay<T = unknown>(maxOrArgs: number | MakeRandomFunction): MonoTypeOperatorFunction<T> {
  const makeRandomDelay = makeRandomFunction(maxOrArgs);
  return randomDelayWithRandomFunction(makeRandomDelay);
}

export function randomDelayWithRandomFunction<T = unknown>(makeRandomDelay: RandomNumberFunction, scheduler: SchedulerLike = asyncScheduler): MonoTypeOperatorFunction<T> {
  return delayWhen(() => timer(makeRandomDelay(), scheduler));
}
