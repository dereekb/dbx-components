import type { MatTextareaField } from '@ng-forge/dynamic-forms-material';
import type { TransformStringFunctionConfigRef } from '@dereekb/util';
import type { FieldAutocompleteAttributeOptionRef } from '../../../../field/field.autocomplete';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef } from '../../field';
import { configureForgeAutocompleteFieldMeta } from '../../field.util.meta';
import { dbxForgeDefaultValidationMessages } from '../../../validation';

// MARK: TextArea Field
/**
 * Configuration for a multi-line textarea input field in forge.
 */
export interface DbxForgeTextAreaFieldConfig extends DbxForgeFieldFunctionDef<MatTextareaField>, FieldAutocompleteAttributeOptionRef, Partial<TransformStringFunctionConfigRef> {
  /**
   * Number of visible text rows. Defaults to 3.
   */
  readonly rows?: number;
  readonly defaultValue?: string;
}

/**
 * Creates a forge field definition for a multi-line textarea input.
 *
 * @param config - Textarea field configuration including key, label, rows, and validation options
 * @returns A textarea field with type `'textarea'`
 *
 * @example
 * ```typescript
 * const field = forgeTextAreaField({ key: 'bio', label: 'Biography', rows: 5, maxLength: 500 });
 * ```
 */
export const forgeTextAreaField = dbxForgeFieldFunction<DbxForgeTextAreaFieldConfig>({
  type: 'textarea' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((input) => ({
    rows: input.rows ?? 3
  })),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    // configure autocomplete
    x.configure(configureForgeAutocompleteFieldMeta);

    // set defaults
    if (config.label == null) {
      (config as any).label = '';
    }

    if (config.value == null) {
      (config as any).value = config['defaultValue'] ?? '';
    }

    // convert RegExp pattern to string
    if (config.pattern instanceof RegExp) {
      (config as any).pattern = config.pattern.source;
    }

    // add default validation messages
    x.addValidation({
      validationMessages: dbxForgeDefaultValidationMessages()
    });
  })
});
