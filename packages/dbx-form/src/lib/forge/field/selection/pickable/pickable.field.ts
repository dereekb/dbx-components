import { type PrimativeKey } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Observable } from 'rxjs';
import { type BaseValueField } from '@ng-forge/dynamic-forms';
import { type PickableValueFieldDisplayFunction, type PickableValueFieldFilterFunction, type PickableValueFieldHashFunction, type PickableValueFieldLoadValuesFunction } from '../../../../formly/field/selection/pickable/pickable';
import { type PickableItemFieldItemSortFn } from '../../../../formly/field/selection/pickable/pickable.field.directive';

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
  readonly loadValues: PickableValueFieldLoadValuesFunction<T, M>;
  readonly displayForValue: PickableValueFieldDisplayFunction<T, M>;
  readonly hashForValue?: PickableValueFieldHashFunction<T, H>;
  readonly filterValues?: PickableValueFieldFilterFunction<T, M>;
  readonly sortItems?: PickableItemFieldItemSortFn<T, M>;
  readonly multiSelect?: boolean;
  readonly asArrayValue?: boolean;
  readonly showTextFilter?: boolean;
  readonly skipFilterFnOnEmpty?: boolean;
  readonly filterLabel?: string;
  readonly maxPicks?: number;
  readonly showSelectAllButton?: boolean;
  readonly changeSelectionModeToViewOnDisabled?: boolean;
  readonly footerConfig?: DbxInjectionComponentConfig;
  readonly refreshDisplayValues$?: Observable<unknown>;
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
