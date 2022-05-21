import { Configurable } from '../type';

/**
 * Denotes a typically read-only like model is being built/configured.
 */
export type Building<T> = Partial<Configurable<T>>;

export type BuildFunction<T> = (base: Building<T>) => void;

export interface BuildConfig<T extends object> {
  base?: Building<T>;
  build: BuildFunction<T>
}

/**
 * Convenience function that is used to "build" an object of a specific type.
 * 
 * @param base 
 * @param buildFn 
 * @returns 
 */
export function build<T extends object>({ base, build }: BuildConfig<T>): T {
  build(base ?? {});
  return base as T;
}
