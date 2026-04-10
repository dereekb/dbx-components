import type { MatMultiCheckboxField, MatMultiCheckboxProps } from '@ng-forge/dynamic-forms-material';
import type { FieldOption } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../field';

/**
 * Configuration for a forge multi-checkbox (checklist) field.
 */
export interface DbxForgeChecklistFieldConfig<T = unknown> {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Checkbox options to display.
   */
  readonly options: readonly FieldOption<T>[];
  /**
   * Position of labels relative to the checkboxes.
   */
  readonly labelPosition?: 'before' | 'after';
  /**
   * Default selected values.
   */
  readonly defaultValue?: T[];
}

/**
 * Creates a forge field definition for a Material multi-checkbox (checklist) field.
 *
 * @param config - Checklist field configuration
 * @returns A validated {@link MatMultiCheckboxField} with type `'multi-checkbox'`
 *
 * @example
 * ```typescript
 * const field = forgeChecklistField({
 *   key: 'tags',
 *   label: 'Tags',
 *   options: [
 *     { label: 'Frontend', value: 'frontend' },
 *     { label: 'Backend', value: 'backend' }
 *   ]
 * });
 * ```
 */
export function forgeChecklistField<T = unknown>(config: DbxForgeChecklistFieldConfig<T>): MatMultiCheckboxField<T> {
  const { key, label, required, readonly: isReadonly, description, options, labelPosition, defaultValue = [] } = config;

  const props: Partial<MatMultiCheckboxProps> = filterFromPOJO({
    hint: description,
    labelPosition
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: 'multi-checkbox' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly,
      options,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatMultiCheckboxField<T>
  );
}
