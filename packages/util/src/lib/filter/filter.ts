
export interface Filter<F> {
  filter?: F;
}

export interface OptionalFilter<F> extends Partial<Filter<F>> { }

/**
 * Used to invert a filter function by returning the opposite of what it returns.
 * 
 * @param filterFn 
 * @param invert whether or not to apply the inversion.
 * @returns 
 */
export function invertFilter<F extends (((value: any, index: number) => boolean) | ((value: any) => boolean) | (() => boolean)) = () => boolean>(filterFn: F, invert = true): F {
  if (invert) {
    return (() => {
      const result: boolean = (filterFn as any).apply(undefined, arguments as any);
      return !result;
    }) as any;
  } else {
    return filterFn;
  }
}
