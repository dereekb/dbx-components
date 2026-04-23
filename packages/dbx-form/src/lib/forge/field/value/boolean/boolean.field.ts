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
 * Creates a forge field definition for a Material slide toggle.
 *
 * @param config - Toggle field configuration
 * @returns A validated {@link MatToggleField} with type `'toggle'`
 *
 * @example
 * ```typescript
 * const field = dbxForgeToggleField({ key: 'active', label: 'Active', value: true });
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
 * Creates a forge field definition for a Material checkbox.
 *
 * @param config - Checkbox field configuration
 * @returns A validated {@link MatCheckboxField} with type `'checkbox'`
 *
 * @example
 * ```typescript
 * const field = dbxForgeCheckboxField({ key: 'agree', label: 'I agree to the terms' });
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
