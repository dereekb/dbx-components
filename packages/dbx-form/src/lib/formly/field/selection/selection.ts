import { PrimativeKey, Maybe, MapFunction } from '@dereekb/util';

export interface SelectionValue<T, M = unknown> {
  /**
   * Value associated with this field.
   */
  value: T;
  /**
   * Optional metadata on the field.
   */
  meta?: Maybe<M>;
}

/**
 * Displayed value.
 */
export interface SelectionDisplayValue<T, M = unknown> extends SelectionValue<T, M> {
  label: string;
  sublabel?: string;
  /**
   * Whether or not the value is known.
   */
  isUnknown?: Maybe<boolean>;
}

/**
 * Used to hash the value from the input pickable value.
 */
export type SelectionValueHashFunction<T, H extends PrimativeKey = PrimativeKey> = MapFunction<T, H>;

// MARK: Compat
/**
 * @deprecated Use SelectionValueHashFunction
 */
export type SelectionValueHashFn<T, H extends PrimativeKey = PrimativeKey> = SelectionValueHashFunction<T, H>;
