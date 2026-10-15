import { type ArrayOrValue, type LabelRef, type Maybe, type PrimativeKey } from '@dereekb/util';
import { type BaseValueField } from '@ng-forge/dynamic-forms';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { type DbxForgeSearchableTextFieldProps } from './searchable-text.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Field Type Name
/**
 * The custom forge field type name for the searchable chip field.
 */
export const DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME = 'dbx-searchable-chip' as const;

// MARK: Input
/**
 * Default input preview shown while the input is empty and unfocused, when {@link DbxForgeSearchableChipFieldProps.inputOnNewLine} is enabled.
 */
export const DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW = '|';

// MARK: Suggestions
/**
 * Default label rendered before a searchable chip field's suggestion chips.
 */
export const DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_SUGGESTIONS_LABEL = 'Suggestions';

/**
 * A suggestion rendered as a clickable chip beneath a searchable chip field's input.
 *
 * Picking the suggestion adds its value(s) to the field. The suggestion is hidden once every one of its values is already selected.
 */
export interface DbxForgeSearchableChipFieldSuggestion<T = unknown> extends LabelRef {
  /**
   * Value, or values, added to the field when the suggestion is picked.
   */
  readonly value: ArrayOrValue<T>;
  /**
   * Optional secondary text rendered after the label.
   */
  readonly sublabel?: Maybe<string>;
  /**
   * Optional Material icon rendered as the chip avatar. Defaults to `add`.
   */
  readonly icon?: Maybe<string>;
  /**
   * Optional tooltip shown when hovering the suggestion.
   */
  readonly tooltip?: Maybe<string>;
}

// MARK: Props
/**
 * Props interface for the forge searchable chip field.
 */
export interface DbxForgeSearchableChipFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeSearchableTextFieldProps<T, M, H> {
  readonly multiSelect?: boolean;
  readonly asArrayValue?: boolean;
  /**
   * Whether to render the text input on its own line beneath the selected chips, rather than inline after the last chip.
   */
  readonly inputOnNewLine?: Maybe<boolean>;
  /**
   * Preview text shown in the input while it is empty and unfocused, marking where typing starts. Only used when the field has no `placeholder`; a
   * configured placeholder is always shown instead.
   *
   * Defaults to {@link DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW} when {@link inputOnNewLine} is true, otherwise no preview is shown.
   */
  readonly inputPreview?: Maybe<string>;
  /**
   * Whether Backspace removes chips, Angular Material's default chip behavior: Backspace in the empty input focuses the last chip, and Backspace on a
   * focused chip removes it.
   *
   * False by default, so pressing Backspace repeatedly never walks back into and deletes the selected chips. Chips can still be removed with their
   * remove button or the Delete key.
   */
  readonly backspaceRemovesChips?: Maybe<boolean>;
  /**
   * Suggestions rendered as clickable chips beneath the input. Picking one adds its value(s) to the field.
   */
  readonly suggestions?: Maybe<DbxForgeSearchableChipFieldSuggestion<T>[]>;
  /**
   * Label rendered before the suggestion chips. Defaults to {@link DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_SUGGESTIONS_LABEL}.
   */
  readonly suggestionsLabel?: Maybe<string>;
}

// MARK: Field Def
/**
 * Forge field definition interface for the searchable chip field.
 */
export interface DbxForgeSearchableChipFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgeSearchableChipFieldProps<T, M, H>, T | T[]> {
  readonly type: typeof DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME;
}

// MARK: Searchable Chip Field
/**
 * Configuration for a forge searchable chip field (multi-value autocomplete with chips).
 */
export interface DbxForgeSearchableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeSearchableChipFieldDef<T, M, H>> {}

export type DbxForgeSearchableChipFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableChipFieldConfig<T, M, H>) => DbxForgeField<DbxForgeSearchableChipFieldDef<T, M, H>>;

/**
 * Multi-value autocomplete with chips. Defaults to multi-select; supports free-form text entry when `allowStringValues` is set, and clickable suggestion chips via `suggestions`.
 *
 * @param config - Searchable chip field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a searchable chip field
 *
 * @dbxFormField
 * @dbxFormSlug searchable-chip
 * @dbxFormTier field-factory
 * @dbxFormProduces T | T[]
 * @dbxFormArrayOutput optional
 * @dbxFormNgFormType dbx-searchable-chip
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeSearchableChipFieldConfig<T, M, H>
 * @dbxFormGeneric <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>
 *
 * @example
 * ```typescript
 * dbxForgeSearchableChipField<Tag>({ key: 'tags', props: { search, displayForValue } })
 * ```
 */
export const dbxForgeSearchableChipField = dbxForgeFieldFunction<DbxForgeSearchableChipFieldConfig>({
  type: DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgeSearchableChipFieldFunction;

/**
 * Configuration for a forge searchable string chip field, pre-configured for string values.
 *
 * `allowStringValues` is omitted from the config — it is always forced to `true`
 * so users can type a value and press Enter to add it as a chip.
 */
export type DbxForgeSearchableStringChipFieldConfig<M = unknown> = Omit<DbxForgeSearchableChipFieldConfig<string, M>, 'props'> & {
  readonly props?: Omit<DbxForgeSearchableChipFieldProps<string, M>, 'allowStringValues'>;
};

/**
 * String-value specialization of `searchable-chip`. `allowStringValues` is forced true — use for free-form tag entry.
 *
 * Always sets `allowStringValues: true` on the inner field props so pressing Enter
 * (or typing a separator key) commits the typed value as a chip.
 *
 * @param config - String-specific searchable chip field configuration (omits allowStringValues)
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a searchable chip field.
 *
 * @dbxFormField
 * @dbxFormSlug searchable-string-chip
 * @dbxFormTier field-factory
 * @dbxFormProduces string | string[]
 * @dbxFormArrayOutput optional
 * @dbxFormNgFormType dbx-searchable-chip
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeSearchableStringChipFieldConfig
 *
 * @example
 * ```typescript
 * dbxForgeSearchableStringChipField({ key: 'tags', props: { search, displayForValue } })
 * ```
 */
export function dbxForgeSearchableStringChipField<M = unknown>(config: DbxForgeSearchableStringChipFieldConfig<M>) {
  return dbxForgeSearchableChipField<string, M>({
    ...config,
    props: {
      ...config.props,
      allowStringValues: true
    }
  } as DbxForgeSearchableChipFieldConfig<string, M>);
}
