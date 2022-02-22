import { Maybe } from "@dereekb/util";

export interface SelectionValue<T, M = any> {
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
export interface SelectionDisplayValue<T, M = any> extends SelectionValue<T, M> {
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
export type SelectionValueHashFn<T> = (value: T) => any;
