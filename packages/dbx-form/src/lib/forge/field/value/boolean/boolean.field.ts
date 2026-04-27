import type { MatToggleField, MatCheckboxField } from '@ng-forge/dynamic-forms-material';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';

/**
 * CSS class applied to forge fields when `styledBox` is enabled.
 *
 * Mirrors the Material outlined form-field appearance for fields that don't use `<mat-form-field>` (checkbox, toggle, slider).
 */
export const FORGE_STYLED_BOX_CLASS = 'dbx-forge-styled-box';

// MARK: Toggle Field
/**
 * Configuration for a forge Material toggle (slide toggle) field.
 */
export interface DbxForgeToggleFieldConfig extends DbxForgeFieldFunctionDef<MatToggleField> {
  /**
   * Whether to render the toggle inside a styled outline box.
   *
   * Defaults to `true`.
   */
  readonly styledBox?: boolean;
}

/**
 * Material slide toggle. Renders inside a styled outline box by default so it visually matches surrounding outlined form fields; pass `styledBox: false` to opt out.
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
 * @dbxFormWrapperPattern unwrapped
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
      (config as any).className = config.className ?? FORGE_STYLED_BOX_CLASS;
    }
  })
}) as DbxForgeFieldFunction<DbxForgeToggleFieldConfig, MatToggleField>;

// MARK: Checkbox Field
/**
 * Configuration for a forge Material checkbox field.
 */
export interface DbxForgeCheckboxFieldConfig extends DbxForgeFieldFunctionDef<MatCheckboxField> {
  /**
   * Whether to render the checkbox inside a styled outline box.
   *
   * Defaults to `true`.
   */
  readonly styledBox?: boolean;
}

/**
 * Material checkbox. Shares the styled-outline-box opt-out with toggle.
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
 * @dbxFormWrapperPattern unwrapped
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
      (config as any).className = config.className ?? FORGE_STYLED_BOX_CLASS;
    }
  })
}) as DbxForgeFieldFunction<DbxForgeCheckboxFieldConfig, MatCheckboxField>;
