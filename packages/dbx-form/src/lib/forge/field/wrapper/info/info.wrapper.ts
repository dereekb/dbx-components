import type { WrapperTypeDefinition } from '@ng-forge/dynamic-forms';

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
 * {@link FieldWrapperContract} and receives onInfoClick callback
 * and ariaLabel configuration via component inputs.
 */
export const DBX_FORGE_INFO_WRAPPER_TYPE: WrapperTypeDefinition<DbxForgeInfoWrapper> = {
  wrapperName: DBX_FORGE_INFO_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./info.wrapper.component').then((m) => m.DbxForgeInfoWrapperComponent)
};
