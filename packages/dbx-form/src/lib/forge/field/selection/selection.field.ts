import type { MatSelectField, MatSelectProps } from '@ng-forge/dynamic-forms-material';
import type { FieldOption } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import type { Observable } from 'rxjs';
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
   * Options to select from. Accepts any object with label and value properties.
   *
   * NOTE: ng-forge SelectField only supports static arrays. If an Observable is provided,
   * it is not supported and will be ignored — pass a static array instead.
   */
  readonly options: readonly { label: string; value: T }[] | Observable<readonly { label: string; value: T }[]>;
  /**
   * Allow selecting multiple values and return an array.
   */
  readonly multiple?: boolean;
  /**
   * Default selected value.
   */
  readonly defaultValue?: T;
  /**
   * When true or a string, adds a clear/reset option at the top of the options list.
   * If a string is provided, it is used as the clear option label.
   *
   * @default false
   */
  readonly addClearOption?: boolean | string;
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
  const { key, label, required, readonly: isReadonly, description, options, multiple, defaultValue, addClearOption } = config;

  const props: Partial<MatSelectProps> = filterFromPOJO({
    hint: description,
    multiple
  });

  // Build options array, prepending a clear option if configured
  let resolvedOptions: readonly { label: string; value: T }[];

  if (Array.isArray(options)) {
    resolvedOptions = options;
  } else {
    // Observable options are not supported by ng-forge SelectField — fall back to empty array.
    // The formly variant supports Observable options; forge does not.
    resolvedOptions = [];
  }

  if (addClearOption) {
    const clearLabel = typeof addClearOption === 'string' ? addClearOption : '-- Clear --';
    resolvedOptions = [{ label: clearLabel, value: null as unknown as T }, ...resolvedOptions];
  }

  return forgeField(
    filterFromPOJO({
      key,
      type: 'select' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly,
      options: resolvedOptions as FieldOption<T>[],
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatSelectField<T>
  );
}
