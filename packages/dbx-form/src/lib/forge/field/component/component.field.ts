import { filterFromPOJO } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../field.util.meta';
import { FORGE_COMPONENT_FIELD_TYPE, type DbxForgeComponentFieldProps, type DbxForgeComponentFieldDef } from './component.field.component';
import type { DbxForgeFieldConfig } from '../field.type';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the dynamic component injection field.
 *
 * Register via `provideDynamicForm(DBX_COMPONENT_FIELD_TYPE)`.
 */
export const DBX_COMPONENT_FIELD_TYPE: FieldTypeDefinition<DbxForgeComponentFieldDef> = {
  name: FORGE_COMPONENT_FIELD_TYPE,
  loadComponent: () => import('./component.field.component').then((m) => m.DbxForgeComponentFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for a forge field that renders a custom Angular component.
 */
export interface DbxForgeComponentFieldConfig<T = unknown> extends Omit<DbxForgeFieldConfig, 'key'> {
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
  /**
   * Whether to visually indicate the disabled state on this component.
   *
   * Defaults to `true`. Set to `false` for display-only components that should
   * remain visually unchanged when the form is disabled.
   */
  readonly allowDisabledEffects?: boolean;
}

/**
 * Counter for generating unique keys when no explicit key is provided.
 *
 * Each invocation gets a unique key so that ng-forge's field reconciliation
 * (`reconcileFields`) treats a config change as a new field rather than
 * preserving the stale instance whose captured `props` never update.
 */
let _componentFieldCounter = 0;

/**
 * Creates a forge field definition that renders a custom Angular component.
 *
 * Uses {@link DbxInjectionComponent} to dynamically inject any Angular component
 * into the form. Generates a unique key when none is provided so that ng-forge's
 * field reconciliation treats each config change as a new field instance.
 *
 * @param config - Component field configuration
 * @returns A validated {@link DbxForgeComponentFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeComponentField({
 *   key: 'custom',
 *   componentField: { componentClass: MyCustomFormComponent, data: { someInput: 'value' } }
 * });
 * ```
 */
export function forgeComponentField<T = unknown>(config: DbxForgeComponentFieldConfig<T>): DbxForgeComponentFieldDef<T> {
  const { key, label, componentField, allowDisabledEffects, logic } = config;

  return forgeField({
    key: key || `_component_${++_componentFieldCounter}`,
    type: FORGE_COMPONENT_FIELD_TYPE,
    label: label ?? '',
    value: undefined as unknown,
    logic,
    props: filterFromPOJO({
      componentField,
      allowDisabledEffects
    }) as DbxForgeComponentFieldProps<T>
  } as DbxForgeComponentFieldDef<T>);
}
