import { filterFromPOJO } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../field';
import type { ForgeComponentFieldProps, ForgeComponentFieldDef } from './component.field.component';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the dynamic component injection field.
 *
 * Register via `provideDynamicForm(DBX_COMPONENT_FIELD_TYPE)`.
 */
export const DBX_COMPONENT_FIELD_TYPE: FieldTypeDefinition<ForgeComponentFieldDef> = {
  name: 'dbx-component',
  loadComponent: () => import('./component.field.component').then((m) => m.DbxForgeComponentFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for a forge field that renders a custom Angular component.
 */
export interface ForgeComponentFieldConfig<T = unknown> {
  /**
   * Key for the field. Optional for display-only components.
   */
  readonly key?: string;
  /**
   * Label for the field.
   */
  readonly label?: string;
  /**
   * The injection component configuration describing which component to render.
   */
  readonly componentField: DbxInjectionComponentConfig<T>;
}

/**
 * Creates a forge field definition that renders a custom Angular component.
 *
 * Uses {@link DbxInjectionComponent} to dynamically inject any Angular component
 * into the form. This is useful for embedding complex custom UI within a dynamic form.
 *
 * @param config - Component field configuration
 * @returns A validated {@link ForgeComponentFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeComponentField({
 *   key: 'custom',
 *   componentField: { componentClass: MyCustomFormComponent, data: { someInput: 'value' } }
 * });
 * ```
 */
export function forgeComponentField<T = unknown>(config: ForgeComponentFieldConfig<T>): ForgeComponentFieldDef<T> {
  const { key, label, componentField } = config;

  return forgeField(
    filterFromPOJO({
      key: key || '_component',
      type: 'dbx-component' as const,
      label: label ?? '',
      value: undefined as unknown,
      props: {
        componentField
      } as ForgeComponentFieldProps<T>
    }) as ForgeComponentFieldDef<T>
  );
}
