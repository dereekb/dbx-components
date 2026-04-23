import { type PrimativeKey } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Observable } from 'rxjs';
import { type ValidatorFn } from '@angular/forms';
import { type BaseValueField } from '@ng-forge/dynamic-forms';
import { type SearchableValueFieldStringSearchFn, type SearchableValueFieldDisplayFn, type SearchableValueFieldHashFn, type SearchableValueFieldAnchorFn } from '../../../../formly/field/selection/searchable/searchable';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Field Type Name
/**
 * The custom forge field type name for the searchable text field.
 */
export const DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME = 'dbx-searchable-text' as const;

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

// MARK: Field Def
/**
 * Forge field definition interface for the searchable text field.
 */
export interface DbxForgeSearchableTextFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgeSearchableTextFieldProps<T, M, H>, T> {
  readonly type: typeof DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME;
}

// MARK: Searchable Text Field
/**
 * Configuration for a forge searchable text field (single-value autocomplete).
 */
export interface DbxForgeSearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeSearchableTextFieldDef<T, M, H>> {}

export type DbxForgeSearchableTextFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableTextFieldConfig<T, M, H>) => DbxForgeField<DbxForgeSearchableTextFieldDef<T, M, H>>;

/**
 * Creates a forge field definition for a searchable text field with autocomplete.
 *
 * @param config - Searchable text field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a searchable text field
 *
 * @example
 * ```typescript
 * const field = dbxForgeSearchableTextField({
 *   key: 'assignee',
 *   label: 'Assignee',
 *   props: {
 *     search: (text) => mySearchService.search(text),
 *     displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.name ?? '' })))
 *   }
 * });
 * ```
 */
export const dbxForgeSearchableTextField = dbxForgeFieldFunction<DbxForgeSearchableTextFieldConfig>({
  type: DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgeSearchableTextFieldFunction;
