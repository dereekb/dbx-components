import { MonoTypeOperatorFunction, tap } from 'rxjs';

/**
 * Used to log a message to the console.
 * 
 * @param messageOrFunction 
 * @returns 
 */
export function tapLog<T = any>(message: string | number, consoleLogFn?: 'log' | 'warn' | 'error'): MonoTypeOperatorFunction<T>;
export function tapLog<T = any>(messageFunction: (value: T) => any[], consoleLogFn?: 'log' | 'warn' | 'error'): MonoTypeOperatorFunction<T>;
export function tapLog<T = any>(messageOrFunction: (string | number) | ((value: T) => any[]), consoleLogFn: 'log' | 'warn' | 'error' = 'log'): MonoTypeOperatorFunction<T> {
  let operator: MonoTypeOperatorFunction<T>;

  if (typeof messageOrFunction === 'function') {
    operator = tap((x) => console[consoleLogFn].apply(undefined, messageOrFunction(x)));
  } else {
    operator = tap((x) => console[consoleLogFn](`${messageOrFunction}`, x));
  }

  return operator;
}
