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
 * Creates an info wrapper config for use in a field's `wrappers` array.
 *
 * @example
 * ```typescript
 * dbxForgeNameField({
 *   wrappers: [dbxForgeInfoWrapper({ onInfoClick: () => openHelp() })]
 * })
 * ```
 */
export function dbxForgeInfoWrapper(config: Omit<DbxForgeInfoWrapper, 'type'>): DbxForgeInfoWrapper {
  return { type: DBX_FORGE_INFO_WRAPPER_TYPE_NAME, ...config };
}
