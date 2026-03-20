import { type RandomNumberFactoryConfig, randomNumberFactory, type RandomNumberFactory } from '@dereekb/util';
import { type MonoTypeOperatorFunction, tap, delayWhen, timer, type SchedulerLike, asyncScheduler } from 'rxjs';

/**
 * RxJS operator that logs each emission to the console as a side-effect.
 *
 * Accepts either a static label or a function that produces log arguments from the emitted value.
 *
 * @example
 * ```ts
 * source$.pipe(
 *   tapLog('Value:')
 * ).subscribe();
 * // logs "Value: <emitted value>" for each emission
 * ```
 *
 * @param message - static label or function returning log arguments
 * @param consoleLogFn - which console method to use (defaults to 'log')
 * @returns a tap operator that logs emissions
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
 * RxJS operator that adds a random delay before each emission.
 *
 * Useful for simulating network latency or staggering requests.
 *
 * @param maxOrArgs - maximum delay in ms, or a full random number config
 * @returns an operator that delays each emission by a random amount
 */
export function randomDelay<T = unknown>(maxOrArgs: number | RandomNumberFactoryConfig): MonoTypeOperatorFunction<T> {
  const makeRandomDelay = randomNumberFactory(maxOrArgs);
  return randomDelayWithRandomFunction(makeRandomDelay);
}

/**
 * RxJS operator that adds a random delay using a custom random number generator.
 *
 * @param makeRandomDelay - factory that produces random delay values
 * @param scheduler - the scheduler to use for the delay (defaults to asyncScheduler)
 * @returns an operator that delays each emission
 */
export function randomDelayWithRandomFunction<T = unknown>(makeRandomDelay: RandomNumberFactory, scheduler: SchedulerLike = asyncScheduler): MonoTypeOperatorFunction<T> {
  return delayWhen(() => timer(makeRandomDelay(), scheduler));
}
