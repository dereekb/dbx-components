import type { LabeledValue } from '@dereekb/util';

/**
 * A selectable option with a value, label, and optional disabled state.
 */

export interface ValueSelectionOptionWithValue<T> extends Readonly<LabeledValue<T>> {
  readonly disabled?: boolean;
}

/**
 * A special "clear" option that resets the selection when chosen.
 */

export interface ValueSelectionOptionClear {
  readonly label?: string;
  readonly clear: true;
}

/**
 * A selectable option: either a value option or a clear option.
 */

export type ValueSelectionOption<T> = ValueSelectionOptionWithValue<T> | ValueSelectionOptionClear;
