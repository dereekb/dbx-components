import { type PrimativeKey } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Observable } from 'rxjs';
import { type ValidatorFn } from '@angular/forms';
import { type BaseValueField } from '@ng-forge/dynamic-forms';
import { type SearchableValueFieldStringSearchFn, type SearchableValueFieldDisplayFn, type SearchableValueFieldHashFn, type SearchableValueFieldAnchorFn } from '../../../../formly/field/selection/searchable/searchable';

// MARK: Field Type Names
/**
 * The custom forge field type name for the searchable text field.
 */
export const FORGE_SEARCHABLE_TEXT_FIELD_TYPE = 'dbx-searchable-text' as const;

/**
 * The custom forge field type name for the searchable chip field.
 */
export const FORGE_SEARCHABLE_CHIP_FIELD_TYPE = 'dbx-searchable-chip' as const;

// MARK: Props
/**
 * Props interface for the forge searchable text field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgeSearchableTextFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> {
  readonly search: SearchableValueFieldStringSearchFn<T, M>;
  readonly displayForValue: SearchableValueFieldDisplayFn<T, M>;
  readonly hashForValue?: SearchableValueFieldHashFn<T, H>;
  readonly allowStringValues?: boolean;
  readonly convertStringValue?: (text: string) => T;
  readonly showSelectedValue?: boolean;
  readonly searchOnEmptyText?: boolean;
  readonly display?: Partial<DbxInjectionComponentConfig>;
  readonly useAnchor?: boolean;
  readonly anchorForValue?: SearchableValueFieldAnchorFn<T, M>;
  readonly showClearValue?: boolean;
  readonly searchLabel?: string;
  readonly refreshDisplayValues$?: Observable<unknown>;
  readonly hint?: string;
  readonly textInputValidator?: ValidatorFn | ValidatorFn[];
}

/**
 * Props interface for the forge searchable chip field.
 */
export interface DbxForgeSearchableChipFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeSearchableTextFieldProps<T, M, H> {
  readonly multiSelect?: boolean;
  readonly asArrayValue?: boolean;
}

// MARK: Field Defs
/**
 * Forge field definition interface for the searchable text field.
 */
export interface DbxForgeSearchableTextFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgeSearchableTextFieldProps<T, M, H>, T> {
  readonly type: typeof FORGE_SEARCHABLE_TEXT_FIELD_TYPE;
}

/**
 * Forge field definition interface for the searchable chip field.
 */
export interface DbxForgeSearchableChipFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgeSearchableChipFieldProps<T, M, H>, T | T[]> {
  readonly type: typeof FORGE_SEARCHABLE_CHIP_FIELD_TYPE;
}
