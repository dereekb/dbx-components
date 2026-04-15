import type { FieldDef, WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';

// MARK: Wrapper Type
/**
 * Registered wrapper type name for the working wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains.
 */
export const DBX_FORGE_WORKING_WRAPPER_TYPE_NAME = 'dbx-forge-working-wrapper' as const;

/**
 * Configuration for the working wrapper type.
 *
 * Shows an indeterminate progress bar when any child field has pending
 * async validation. No additional configuration is needed — the wrapper
 * monitors the form tree's pending state automatically.
 *
 * @example
 * ```typescript
 * const wrapper: DbxForgeWorkingWrapper = {
 *   type: 'dbx-forge-working-wrapper',
 * };
 * ```
 */
export interface DbxForgeWorkingWrapper {
  readonly type: typeof DBX_FORGE_WORKING_WRAPPER_TYPE_NAME;
}

/**
 * ng-forge {@link WrapperTypeDefinition} registration for the working wrapper.
 *
 * Lazy-loads {@link DbxForgeWorkingWrapperComponent} which implements
 * {@link FieldWrapperContract} and monitors the field tree's pending state
 * to display a loading indicator.
 */
export const DBX_FORGE_WORKING_WRAPPER_TYPE: WrapperTypeDefinition<DbxForgeWorkingWrapper> = {
  wrapperName: DBX_FORGE_WORKING_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./working.wrapper.component').then((m) => m.DbxForgeWorkingWrapperComponent)
};

// MARK: Config
/**
 * Configuration for creating a forge working wrapper field.
 */
export interface DbxForgeWorkingWrapperFieldConfig {
  /**
   * Child field definitions to render inside the working wrapper.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Optional key override. Defaults to auto-generated `_working_wrapper_N`.
   */
  readonly key?: string;
}

let _forgeWorkingWrapperCounter = 0;

/**
 * Creates a forge working wrapper field that renders child fields with a
 * loading indicator that appears during async validation.
 *
 * @param config - Working wrapper configuration
 * @returns A {@link WrapperField}
 *
 * @example
 * ```typescript
 * const working = forgeWorkingFieldWrapper({
 *   fields: [
 *     forgeTextField({ key: 'username', label: 'Username' })
 *   ]
 * });
 * ```
 */
export function forgeWorkingFieldWrapper(config: DbxForgeWorkingWrapperFieldConfig): WrapperField {
  const { fields, key } = config;

  return {
    type: 'wrapper',
    key: key ?? `_working_wrapper_${_forgeWorkingWrapperCounter++}`,
    fields,
    wrappers: [{ type: DBX_FORGE_WORKING_WRAPPER_TYPE_NAME } as DbxForgeWorkingWrapper]
  } as unknown as WrapperField;
}
