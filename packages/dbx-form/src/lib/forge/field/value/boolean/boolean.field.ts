import type { DynamicText } from '@ng-forge/dynamic-forms';
import type { MatToggleField, MatCheckboxField } from '@ng-forge/dynamic-forms-material';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';
import { configureDbxForgeFormFieldWrapperWith } from '../../wrapper/formfield/formfield.wrapper';

/**
 * CSS class applied to forge fields when `styledBox` is enabled.
 *
 * @deprecated Boolean fields now use the Material-style form-field wrapper to render the
 * outlined chrome and standard label/hint/error subscript. Retained as an export for any
 * consumers still referencing the class name directly.
 */
export const FORGE_STYLED_BOX_CLASS = 'dbx-forge-styled-box';

/**
 * Where the field's primary label is rendered when wrapped by the form-field wrapper.
 */
export type DbxForgeBooleanShowLabelAt = 'wrapper' | 'content' | 'both';

// MARK: Toggle Field
/**
 * Configuration for a forge Material toggle (slide toggle) field.
 */
export interface DbxForgeToggleFieldConfig extends DbxForgeFieldFunctionDef<MatToggleField> {
  /**
   * Whether to render the toggle inside the shared Material-style form-field wrapper
   * so it picks up the outlined chrome and properly styled error/hint subscript.
   *
   * Defaults to `true`.
   */
  readonly styledBox?: boolean;
  /**
   * Where to render the field's primary label. Defaults to `'content'`.
   *
   * Ignored if `styledBox` is false.
   */
  readonly showLabelAt?: DbxForgeBooleanShowLabelAt;
  /**
   * Optional secondary label rendered inside the wrapper's content area, regardless
   * of {@link showLabelAt}. Useful for adding helper text inside the box.
   */
  readonly contentLabel?: DynamicText;
}

/**
 * Material slide toggle. Renders inside the shared form-field wrapper by default so
 * it visually matches surrounding outlined form fields and uses the standard error
 * subscript chrome; pass `styledBox: false` to opt out.
 *
 * @param config - Toggle field configuration
 * @returns A validated {@link MatToggleField} with type `'toggle'`
 *
 * @dbxFormField
 * @dbxFormSlug toggle
 * @dbxFormTier field-factory
 * @dbxFormProduces boolean
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType toggle
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeToggleFieldConfig
 * @example
 * ```typescript
 * dbxForgeToggleField({ key: 'active', label: 'Active', value: true })
 * ```
 */
export const dbxForgeToggleField = dbxForgeFieldFunction<DbxForgeToggleFieldConfig>({
  type: 'toggle' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    if (config.styledBox !== false) {
      // Boolean fields render their primary label inline next to the control,
      // so by default the wrapper does not render a label of its own (`'content'`)
      // — the inner field surfaces it. Callers can override via `showLabelAt`.
      x.configure(
        configureDbxForgeFormFieldWrapperWith({
          label: config.showLabelAt === 'content' ? '' : config.label // clear the wrapper label if it should only show in the content
        })
      );

      // clear the wrapper/use empty if it should only show in the wrapper
      if (config.showLabelAt === 'wrapper') {
        config.label = config.contentLabel ?? '';
      }
    }
  })
}) as DbxForgeFieldFunction<DbxForgeToggleFieldConfig, MatToggleField>;

// MARK: Checkbox Field
/**
 * Configuration for a forge Material checkbox field.
 */
export interface DbxForgeCheckboxFieldConfig extends DbxForgeFieldFunctionDef<MatCheckboxField> {
  /**
   * Whether to render the checkbox inside the shared Material-style form-field wrapper
   * so it picks up the outlined chrome and properly styled error/hint subscript.
   *
   * Defaults to `true`.
   */
  readonly styledBox?: boolean;
  /**
   * Where to render the field's primary label. Defaults to `'content'`.
   *
   * Ignored if `styledBox` is false.
   */
  readonly showLabelAt?: DbxForgeBooleanShowLabelAt;
  /**
   * Optional secondary label rendered inside the wrapper's content area, regardless
   * of {@link showLabelAt}. Useful for adding helper text inside the box.
   */
  readonly contentLabel?: DynamicText;
}

/**
 * Material checkbox. Shares the form-field-wrapper opt-out with toggle.
 *
 * @param config - Checkbox field configuration
 * @returns A validated {@link MatCheckboxField} with type `'checkbox'`
 *
 * @dbxFormField
 * @dbxFormSlug checkbox
 * @dbxFormTier field-factory
 * @dbxFormProduces boolean
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType checkbox
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeCheckboxFieldConfig
 *
 * @example
 * ```typescript
 * dbxForgeCheckboxField({ key: 'agree', label: 'I agree to the terms' })
 * ```
 */
export const dbxForgeCheckboxField = dbxForgeFieldFunction<DbxForgeCheckboxFieldConfig>({
  type: 'checkbox' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    if (config.styledBox !== false) {
      // Boolean fields render their primary label inline next to the control,
      // so by default the wrapper does not render a label of its own (`'content'`)
      // — the inner field surfaces it. Callers can override via `showLabelAt`.
      x.configure(
        configureDbxForgeFormFieldWrapperWith({
          label: config.showLabelAt === 'content' ? '' : config.label // clear the wrapper label if it should only show in the content
        })
      );

      // clear the wrapper/use empty if it should only show in the wrapper
      if (config.showLabelAt === 'wrapper') {
        config.label = config.contentLabel ?? '';
      }
    }
  })
}) as DbxForgeFieldFunction<DbxForgeCheckboxFieldConfig, MatCheckboxField>;
