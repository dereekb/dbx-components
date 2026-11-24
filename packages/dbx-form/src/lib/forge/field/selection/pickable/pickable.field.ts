import { type Maybe, type PrimativeKey } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Observable } from 'rxjs';
import { type BaseValueField } from '@ng-forge/dynamic-forms';
import { type PickableValueFieldDisplayFunction, type PickableValueFieldFilterFunction, type PickableValueFieldFilterSelectedValuesFunction, type PickableValueFieldHashFunction, type PickableValueFieldLoadValuesFunction } from '../../../../field/selection/pickable/pickable';
import { type PickableItemFieldItemSortFn } from '../../../../field/selection/pickable/pickable.item';

// MARK: Field Type Names
/**
 * The custom forge field type name for the pickable chip field.
 */
export const FORGE_PICKABLE_CHIP_FIELD_TYPE = 'dbx-pickable-chip' as const;

/**
 * The custom forge field type name for the pickable list field.
 */
export const FORGE_PICKABLE_LIST_FIELD_TYPE = 'dbx-pickable-list' as const;

// MARK: Props
/**
 * Props interface for forge pickable fields (both chip and list variants).
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgePickableFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> {
  /**
   * Loads all pickable values.
   */
  readonly loadValues: PickableValueFieldLoadValuesFunction<T, M>;
  /**
   * Builds the display values for the given values.
   */
  readonly displayForValue: PickableValueFieldDisplayFunction<T, M>;
  /**
   * Hashes a value, used to compare values and drop repeats. The value itself is used when not set.
   */
  readonly hashForValue?: PickableValueFieldHashFunction<T, H>;
  /**
   * Filters the displayed values by the filter text.
   */
  readonly filterValues?: PickableValueFieldFilterFunction<T, M>;
  /**
   * Filters/modifies the selected values at selection time (user pick, remove, select-all), so the field can enforce rules like group exclusivity internally instead of round-tripping conflicting values through external sync. A refused change is not written to the field.
   */
  readonly filterSelectedValues?: PickableValueFieldFilterSelectedValuesFunction<T>;
  /**
   * Sorts the items before they are displayed.
   */
  readonly sortItems?: PickableItemFieldItemSortFn<T, M>;
  /**
   * Whether more than one value can be picked. Defaults to true, and is ignored when `asArrayValue` is false.
   */
  readonly multiSelect?: boolean;
  /**
   * Whether the field's value is an array. When false only one value can be picked, and the field's value is that value. Defaults to true.
   */
  readonly asArrayValue?: boolean;
  /**
   * Whether to show the text filter. Defaults to true when `filterValues` is set.
   */
  readonly showTextFilter?: boolean;
  /**
   * Whether to show every value instead of calling `filterValues` while the filter text is empty. Defaults to true.
   */
  readonly skipFilterFnOnEmpty?: boolean;
  /**
   * Label shown above the text filter.
   */
  readonly filterLabel?: string;
  /**
   * Maximum number of values that can be picked. At the limit every unselected item is disabled until a pick is taken back; a selected item is never disabled, so a selection seeded past the limit can still be reduced. Counts every value in the field, including picks hidden by the text filter. Ignored when only one value can be picked. Limits picking only: add `maxLength` to also make a longer value invalid.
   */
  readonly maxPicks?: Maybe<number>;
  /**
   * Whether to show a toggle that selects, or deselects, every visible item that is not disabled. Not shown when only one value can be picked, or when `maxPicks` is below the number of loaded values. Defaults to false.
   */
  readonly showSelectAllButton?: boolean;
  /**
   * Component to show below the items.
   */
  readonly footerConfig?: DbxInjectionComponentConfig;
  /**
   * Clears the cached display values each time it emits.
   */
  readonly refreshDisplayValues$?: Observable<unknown>;
  /**
   * Hint text shown below the field.
   */
  readonly hint?: string;
}

// MARK: Field Defs
/**
 * Forge field definition interface for the pickable chip field.
 */
export interface DbxForgePickableChipFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgePickableFieldProps<T, M, H>, T | T[]> {
  readonly type: typeof FORGE_PICKABLE_CHIP_FIELD_TYPE;
}

/**
 * Forge field definition interface for the pickable list field.
 */
export interface DbxForgePickableListFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgePickableFieldProps<T, M, H>, T | T[]> {
  readonly type: typeof FORGE_PICKABLE_LIST_FIELD_TYPE;
}
