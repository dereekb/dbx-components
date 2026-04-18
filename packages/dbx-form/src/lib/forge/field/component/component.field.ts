import { filterFromPOJO } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { FORGE_COMPONENT_FIELD_TYPE, type DbxForgeComponentFieldDef } from './component.field.component';
import { dbxForgeFieldFunction, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../field';
import type { DbxForgeField } from '../../form/forge.form';

// MARK: Config
/**
 * Internal config with required key for the factory.
 */
type _DbxForgeComponentFieldConfig<T = unknown> = DbxForgeFieldFunctionDef<DbxForgeComponentFieldDef<T>> & {
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
};

/**
 * Configuration for a forge field that renders a custom Angular component.
 */
export type DbxForgeComponentFieldConfig<T = unknown> = Omit<_DbxForgeComponentFieldConfig<T>, 'key'> & {
  /**
   * Key for the field. Optional for display-only components.
   */
  readonly key?: string;
};

/**
 * Counter for generating unique keys when no explicit key is provided.
 *
 * Each invocation gets a unique key so that ng-forge's field reconciliation
 * (`reconcileFields`) treats a config change as a new field rather than
 * preserving the stale instance whose captured `props` never update.
 */
let _componentFieldCounter = 0;

/**
 * Generic function type for forgeComponentField to preserve caller generics.
 */
export type DbxForgeComponentFieldFunction = <T = unknown>(config: DbxForgeComponentFieldConfig<T>) => DbxForgeField<DbxForgeComponentFieldDef<T>>;

/** @deprecated Use {@link DbxForgeComponentFieldFunction} instead. */
export type ForgeComponentFieldFunction = DbxForgeComponentFieldFunction;

const _dbxForgeComponentField = dbxForgeFieldFunction<_DbxForgeComponentFieldConfig>({
  type: FORGE_COMPONENT_FIELD_TYPE,
  buildProps: (config) =>
    filterFromPOJO({
      componentField: config.componentField,
      allowDisabledEffects: config.allowDisabledEffects
    })
}) as DbxForgeFieldFunction<_DbxForgeComponentFieldConfig, DbxForgeComponentFieldDef>;

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
export const dbxForgeComponentField: DbxForgeComponentFieldFunction = (config) => {
  return _dbxForgeComponentField({
    ...config,
    key: config.key || `_component_${++_componentFieldCounter}`
  } as _DbxForgeComponentFieldConfig) as any;
};

// MARK: Deprecated
/** @deprecated Use {@link dbxForgeComponentField} instead. */
export const forgeComponentField = dbxForgeComponentField;
