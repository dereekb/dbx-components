import { Configurable } from '../type';

/**
 * Denotes a typically read-only like model is being built/configured.
 */
export type Building<T> = Partial<Configurable<T>>;

export type BuildFunction<T> = (base: Building<T>) => void;

/**
 * Convenience function that is used to "build" an object of a specific type.
 * 
 * @param base 
 * @param buildFn 
 * @returns 
 */
export function build<T extends object>(buildFn: BuildFunction<T>): T;
export function build<T extends object>(base: Building<T>, buildFn: BuildFunction<T>): T;
export function build<T extends object>(base: Building<T> | BuildFunction<T>, buildFn?: BuildFunction<T>): T {
  if (typeof base === 'function') {
    base({});
  } else if (buildFn) {
    buildFn(base);
  }

  return base as T;
}
