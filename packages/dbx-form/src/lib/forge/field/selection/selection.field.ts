import type { MatSelectField, MatSelectProps } from '@ng-forge/dynamic-forms-material';
import type { FieldOption } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../field';

/**
 * Configuration for a forge select (dropdown) field.
 */
export interface ForgeValueSelectionFieldConfig<T = unknown> {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Options to select from.
   */
  readonly options: readonly FieldOption<T>[];
  /**
   * Allow selecting multiple values and return an array.
   */
  readonly multiple?: boolean;
  /**
   * Default selected value.
   */
  readonly defaultValue?: T;
}

/**
 * Creates a forge field definition for a Material select (dropdown) field.
 *
 * @param config - Selection field configuration
 * @returns A validated {@link MatSelectField} with type `'select'`
 *
 * @example
 * ```typescript
 * const field = forgeValueSelectionField({
 *   key: 'color',
 *   label: 'Color',
 *   options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }]
 * });
 * ```
 */
export function forgeValueSelectionField<T = unknown>(config: ForgeValueSelectionFieldConfig<T>): MatSelectField<T> {
  const { key, label, required, readonly: isReadonly, description, options, multiple, defaultValue } = config;

  const props: Partial<MatSelectProps> = filterFromPOJO({
    hint: description,
    multiple
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: 'select' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly,
      options,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatSelectField<T>
  );
}
