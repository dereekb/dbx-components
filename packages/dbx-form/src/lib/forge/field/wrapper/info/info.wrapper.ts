import type { FieldDef, WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';

// MARK: Wrapper Type
/**
 * Registered wrapper type name for the info wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains.
 */
export const DBX_FORGE_INFO_WRAPPER_TYPE_NAME = 'dbx-forge-info' as const;

/**
 * Configuration for the info wrapper type.
 *
 * Renders an info icon button beside the wrapped content inside a flex layout.
 *
 * @example
 * ```typescript
 * const wrapper: DbxForgeInfoWrapper = {
 *   type: 'dbx-forge-info',
 *   onInfoClick: () => openHelpDialog(),
 *   ariaLabel: 'Show help for this field',
 * };
 * ```
 */
export interface DbxForgeInfoWrapper {
  readonly type: typeof DBX_FORGE_INFO_WRAPPER_TYPE_NAME;
  /**
   * Callback invoked when the info button is clicked.
   */
  readonly onInfoClick: () => void;
  /**
   * Accessible label for the info button.
   */
  readonly ariaLabel?: string;
}

/**
 * ng-forge {@link WrapperTypeDefinition} registration for the info wrapper.
 *
 * Lazy-loads {@link DbxForgeInfoWrapperComponent} which implements
 * {@link FieldWrapperContract} and injects {@link WRAPPER_FIELD_CONTEXT}
 * for its onInfoClick callback and ariaLabel configuration.
 */
export const DBX_FORGE_INFO_WRAPPER_TYPE: WrapperTypeDefinition<DbxForgeInfoWrapper> = {
  wrapperName: DBX_FORGE_INFO_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./info.wrapper.component').then((m) => m.DbxForgeInfoWrapperComponent)
};

// MARK: Config
/**
 * Configuration for creating a forge info wrapper field.
 */
export interface DbxForgeInfoWrapperFieldConfig {
  /**
   * Child field definitions to render inside the info wrapper.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Callback invoked when the info button is clicked.
   */
  readonly onInfoClick: () => void;
  /**
   * Accessible label for the info button. Defaults to 'More information'.
   */
  readonly ariaLabel?: string;
  /**
   * Optional key override. Defaults to auto-generated `_info_wrapper_N`.
   */
  readonly key?: string;
}

let _forgeInfoWrapperCounter = 0;

/**
 * Creates a forge info wrapper field that renders child fields with an
 * info icon button beside them.
 *
 * @param config - Info wrapper configuration
 * @returns A {@link WrapperField}
 *
 * @example
 * ```typescript
 * const infoField = forgeInfoFieldWrapper({
 *   onInfoClick: () => openHelpDialog(),
 *   fields: [
 *     forgeTextField({ key: 'name', label: 'Name' }),
 *     forgeTextField({ key: 'email', label: 'Email' })
 *   ]
 * });
 * ```
 */
export function forgeInfoFieldWrapper(config: DbxForgeInfoWrapperFieldConfig): WrapperField {
  const { fields, onInfoClick, ariaLabel, key } = config;

  const wrapperConfig: DbxForgeInfoWrapper = {
    type: DBX_FORGE_INFO_WRAPPER_TYPE_NAME,
    onInfoClick,
    ...(ariaLabel != null && { ariaLabel })
  };

  return {
    type: 'wrapper',
    key: key ?? `_info_wrapper_${_forgeInfoWrapperCounter++}`,
    fields,
    wrappers: [wrapperConfig]
  } as unknown as WrapperField;
}
