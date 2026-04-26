import { FORGE_COMPONENT_FIELD_TYPE, type DbxForgeComponentFieldDef, type DbxForgeComponentFieldProps } from './component.field.component';
import { dbxForgeFieldFunction, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../field';
import type { DbxForgeField } from '../../form/forge.form';

// MARK: Config
/**
 * Internal config with required key for the factory.
 */
type _DbxForgeComponentFieldConfig<T = unknown> = Omit<DbxForgeFieldFunctionDef<DbxForgeComponentFieldDef<T>>, 'props'> & {
  readonly props: DbxForgeComponentFieldProps<T>;
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
 * Generic function type for dbxForgeComponentField to preserve caller generics.
 */
export type DbxForgeComponentFieldFunction = <T = unknown>(config: DbxForgeComponentFieldConfig<T>) => DbxForgeField<DbxForgeComponentFieldDef<T>>;

/**
 * @deprecated Use {@link DbxForgeComponentFieldFunction} instead.
 */
export type ForgeComponentFieldFunction = DbxForgeComponentFieldFunction;

const _dbxForgeComponentField = dbxForgeFieldFunction<_DbxForgeComponentFieldConfig>({
  type: FORGE_COMPONENT_FIELD_TYPE
}) as DbxForgeFieldFunction<_DbxForgeComponentFieldConfig, DbxForgeComponentFieldDef>;

/**
 * Escape hatch — injects any Angular component as the field renderer via DbxInjection. Use when no existing form field fits.
 *
 * Uses {@link DbxInjectionComponent} to dynamically inject any Angular component
 * into the form. Generates a unique key when none is provided so that ng-forge's
 * field reconciliation treats each config change as a new field instance.
 *
 * @param config - Component field configuration
 * @returns A validated {@link DbxForgeComponentFieldDef}
 *
 * @dbxFormField
 * @dbxFormSlug component-field
 * @dbxFormTier field-factory
 * @dbxFormProduces T
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType component
 * @dbxFormWrapperPattern unwrapped
 * @dbxFormConfigInterface DbxForgeComponentFieldConfig<T>
 * @dbxFormGeneric <T = unknown>
 *
 * @example
 * ```typescript
 * dbxForgeComponentField<MyValue>({ key: 'custom', props: { component: MyCustomComp } })
 * ```
 */
export const dbxForgeComponentField: DbxForgeComponentFieldFunction = (config) => {
  return _dbxForgeComponentField({
    ...config,
    key: config.key || `_component_${++_componentFieldCounter}`
  } as _DbxForgeComponentFieldConfig) as any;
};
