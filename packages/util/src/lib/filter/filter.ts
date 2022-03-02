
export interface Filter<F> {
  filter?: F;
}

export interface OptionalFilter<F> extends Partial<Filter<F>> { }
