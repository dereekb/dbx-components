import { type DbxFormComponentFieldConfig, type DbxFormComponentFormlyFieldConfig } from './component.field.component';

/**
 * Configuration for a custom Angular component embedded as a Formly field.
 */
export type ComponentFieldConfig<T = unknown> = DbxFormComponentFieldConfig<T>;

/**
 * Creates a Formly field configuration that renders a custom Angular component.
 *
 * @param config - Component field configuration
 * @returns A {@link DbxFormComponentFormlyFieldConfig} with type `'component'`
 *
 * @example
 * ```typescript
 * const field = componentField({ componentClass: MyCustomFormComponent });
 * ```
 */
export function componentField<T = unknown>(config: ComponentFieldConfig<T>): DbxFormComponentFormlyFieldConfig<T> {
  return {
    type: 'component',
    componentField: config
  };
}
