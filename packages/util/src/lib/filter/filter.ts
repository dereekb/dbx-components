export interface Filter<F> {
  filter?: F;
}

export type OptionalFilter<F> = Partial<Filter<F>>;

export type FilterFunction<T = unknown> = (value: T, index: number) => boolean;

/**
 * Used to invert a filter function by returning the opposite of what it returns.
 *
 * @param filterFn
 * @param invert whether or not to apply the inversion.
 * @returns
 */
export function invertFilter<T = unknown, F extends FilterFunction<T> = FilterFunction<T>>(filterFn: F, invert = true): F {
  if (invert) {
    return ((value: T, index: number) => {
      const result: boolean = filterFn.call(null, value, index);
      return !result;
    }) as F;
  } else {
    return filterFn;
  }
}
